/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title The Vote struct that defines a vote in the governance mechanism
/// @param jobId JobId of the proposaed governor.
/// @param proposedGovernor the governor that the voter wants to force reset to
struct Vote {
	uint32 jobId;
	address proposedGovernor;
}

/// @title The Governable contract that defines the governance mechanism
/// @author Webb Technologies.
/// @notice This contract is used to for ownership and governance of smart contracts.
contract Governable {
	address public governor;

	/// Job Id of the rotating the DKG
	uint32 public jobId = 0;

	/// Last time ownership was transferred to a new governor
	uint256 public lastGovernorUpdateTime;

	/// Threshold for the number of votes required to force set the governor.
	uint32 public votingThreshold = 1;

	/// (votingPeriod/refreshNonce => (proposer => (vote of new governor)))
	/// whether a proposer has voted in this period and who they're voting for
	mapping(uint256 => mapping(address => address)) alreadyVoted;

	/// (votingPeriod/refreshNonce => (proposerGovernor => (uint)))
	/// number of votes a proposedGovernor has in the current period
	mapping(uint256 => mapping(address => uint32)) numOfVotesForGovernor;

	event GovernanceOwnershipTransferred(
		address indexed previousOwner,
		uint32 previousOwnerJobId,
		address indexed newOwner,
		uint32 indexed jobId,
		uint256 timestamp
	);
	event RecoveredAddress(address indexed recovered);

	constructor(address _governor, uint32 _jobId, uint32 _votingThreshold) {
		governor = _governor;
		jobId = _jobId;
		votingThreshold = _votingThreshold;
		lastGovernorUpdateTime = block.timestamp;
		emit GovernanceOwnershipTransferred(address(0), 0, _governor, _jobId, block.timestamp);
	}

	/// @notice Throws if called by any account other than the owner.
	modifier onlyGovernor() {
		require(msg.sender == governor, "Governable: caller is not the governor");
		_;
	}

	/// @notice Checks if the vote JobId are valid.
	modifier areValidVotes(Vote[] memory votes) {
		for (uint i = 0; i < votes.length; i++) {
			require(votes[i].jobId > jobId, "Governable: JobId of vote must be greater than current jobId");
			require(
				votes[i].proposedGovernor != address(0x0),
				"Governable: Proposed governor cannot be the zero address"
			);
		}
		_;
	}

	/// @notice Returns true if the signature is signed by the current governor.
	/// @return bool Whether the signature of the data is signed by the governor
	function isSignatureFromGovernor(
		bytes memory data,
		bytes memory sig
	) public view returns (bool) {
		bytes32 hashedData = keccak256(data);
		address signer = ECDSA.recover(hashedData, sig);
		return signer == governor;
	}

	/// @notice Returns true if the signature is signed by the current governor.
	/// @return bool Whether the signature of the data is signed by the governor
	function isSignatureFromGovernorPrehashed(
		bytes32 hashedData,
		bytes memory sig
	) public view returns (bool) {
		address signer = ECDSA.recover(hashedData, sig);
		return signer == governor;
	}

	/// @notice Leaves the contract without owner. It will not be possible to call
	/// `onlyGovernor` functions anymore. Can only be called by the current owner.
	/// @notice Renouncing ownership will leave the contract without an owner,
	/// thereby removing any functionality that is only available to the owner.
	function renounceOwnership() public onlyGovernor {
		votingThreshold = 0;
		jobId = 0;
		governor = address(0);
		emit GovernanceOwnershipTransferred(governor, jobId, address(0), jobId, block.timestamp);
	}

	/// @notice Transfers ownership of the contract to a new account (`newOwner`).
	/// @param newOwner The new owner of the contract.
	/// @param jobId JobId of the new governor.
	/// @notice Can only be called by the current owner.
	function transferOwnership(address newOwner, uint32 jobId) public onlyGovernor {
		_transferOwnership(newOwner, jobId);
	}

	/// @notice Transfers ownership of the contract to a new account associated with the publicKey
	/// @param _jobId The nonce of the proposal.
	/// @param _publicKey The public key of the new governor.
	/// @param _sig The signature of the propsal data.
	function transferOwnershipWithSignature(
		uint32 _jobId,
		bytes memory _publicKey,
		bytes memory _sig
	) public {
		require(_jobId > jobId, "Governable: JobId must be greater than current jobId");
		bytes32 pubKeyHash = keccak256(_publicKey);
		address newOwner = address(uint160(uint256(pubKeyHash)));
		require(
			isSignatureFromGovernor(abi.encodePacked(_publicKey), _sig),
			"Governable: caller is not the governor"
		);
		_transferOwnership(newOwner, _jobId);
	}

	/// @notice Casts a vote in favor of force refreshing the governor
	/// @param vote A vote struct
	function voteInFavorForceSetGovernor(
		Vote memory vote
	) external areValidVotes(arrayifyVote(vote)) {
		// Check merkle proof is valid
		address proposerAddress = msg.sender;
		_processVote(vote, proposerAddress);
	}

	/// @notice Casts a vote in favor of force refreshing the governor with a signature
	/// @param votes Vote structs
	/// @param sigs Signatures of the votes
	function voteInFavorForceSetGovernorWithSig(
		Vote[] memory votes,
		bytes[] memory sigs
	) external areValidVotes(votes) {
		require(votes.length == sigs.length, "Governable: Invalid number of votes and signatures");
		for (uint i = 0; i < votes.length; i++) {
			// Recover the address from the signature
			address proposerAddress = recover(abi.encode(votes[i]), sigs[i]);
			// Since we require voterCount / 2 votes to be in favor of a new governor,
			// we can stop processing votes if we have enough votes for a new governor.
			// Since we have nonces on votes, we can safely assume that the votes from
			// previous rounds cannot be processed. We process and terminate the vote early
			// even if the vote is not the last vote in the array by choice.
			if (_processVote(votes[i], proposerAddress)) {
				return;
			}
		}
	}

	/// @notice Process a vote
	/// @param vote A vote struct
	/// @param voter The address of the voter
	function _processVote(Vote memory vote, address voter) internal returns (bool) {
		// If the proposer has already voted, remove their previous vote
		if (alreadyVoted[vote.jobId][voter] != address(0x0)) {
			address previousVote = alreadyVoted[vote.jobId][voter];
			numOfVotesForGovernor[vote.jobId][previousVote] -= 1;
		}
		// Update the vote mappings
		alreadyVoted[vote.jobId][voter] = vote.proposedGovernor;
		numOfVotesForGovernor[vote.jobId][vote.proposedGovernor] += 1;
		// Try to resolve the vote if enough votes for a proposed governor have been cast.
		// Note: `voterCount` is also assumed to be the maximum # of voters in the system.
		// Therefore, if `voterCount / 2` votes are in favor of a new governor, we can
		// safely assume that there is no other governor that has more votes.
		if (numOfVotesForGovernor[vote.jobId][vote.proposedGovernor] >= votingThreshold) {
			_transferOwnership(vote.proposedGovernor, vote.jobId);
			// If we transferred ownership, we return true to indicate the election is over.
			return true;
		}

		return false;
	}

	/// @notice Transfers ownership of the contract to a new account (`newOwner`).
	/// @param newOwner The new owner of the contract
	/// @param newJobId JobId of the new governor.
	function _transferOwnership(address newOwner, uint32 newJobId) internal {
		require(newOwner != address(0), "Governable: New governor is the zero address");
		address previousGovernor = governor;
		uint32 previousGovernorJobId = jobId;
		governor = newOwner;
		lastGovernorUpdateTime = block.timestamp;
		jobId = newJobId;
		emit GovernanceOwnershipTransferred(
			previousGovernor,
			previousGovernorJobId,
			newOwner,
			newJobId,
			lastGovernorUpdateTime
		);
	}

	/// @notice Helper function for recovering the address from the signature `sig` of `data`
	/// @param data The data being signed
	/// @param sig The signature of the data
	/// @return address The address of the signer
	function recover(bytes memory data, bytes memory sig) public pure returns (address) {
		bytes32 hashedData = keccak256(data);
		address signer = ECDSA.recover(hashedData, sig);
		return signer;
	}

	/// @notice Helper function to arrayify a vote.
	/// @param vote The vote struct
	/// @return Vote[] The arrayified vote
	function arrayifyVote(Vote memory vote) public pure returns (Vote[] memory) {
		Vote[] memory votes = new Vote[](1);
		votes[0] = vote;
		return votes;
	}

	/// @notice Helper function for creating a vote struct
	/// @param _jobId Job id of the proposed governor
	/// @param _proposedGovernor The proposed governor
	/// @return Vote The vote struct
	function createVote(
		uint32 _jobId,
		address _proposedGovernor
	) public pure returns (Vote memory) {
		return Vote(_jobId, _proposedGovernor);
	}
}
