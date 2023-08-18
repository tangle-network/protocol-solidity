/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title The Vote struct that defines a vote in the governance mechanism
/// @param nonce nonce of the proposal
/// @param leafIndex leafIndex of the proposer in the proposer set Merkle tree
/// @param siblingPathNodes Merkle proof path of sibling nodes
/// @param proposedGovernor the governor that the voter wants to force reset to
struct Vote {
	uint32 nonce;
	uint32 leafIndex;
	address proposedGovernor;
	bytes32[] siblingPathNodes;
}

/// @title The Governable contract that defines the governance mechanism
/// @author Webb Technologies.
/// @notice This contract is used to for ownership and governance of smart contracts.
contract Governable {
	address public governor;

	/// Refresh nonce is for rotating the DKG
	uint32 public refreshNonce = 0;

	/// Last time ownership was transferred to a new governor
	uint256 public lastGovernorUpdateTime;

	/// The root of the proposer set Merkle tree
	bytes32 public voterMerkleRoot;

	/// The average session length in millisecs
	/// Note: This default is set to the max value of a uint64 so that there
	/// is no chance of a new governor being voted for before the governance has successfully
	/// been transferred. In this first transferral, the actual session length will be set.
	uint64 public averageSessionLengthInMillisecs = 2 ** 64 - 1;

	/// The session length multiplier (see the voteInFavorForceSetGovernor function below)
	uint256 public sessionLengthMultiplier = 2;

	/// The number of proposers
	uint32 public voterCount;

	/// (votingPeriod/refreshNonce => (proposer => (vote of new governor)))
	/// whether a proposer has voted in this period and who they're voting for
	mapping(uint256 => mapping(address => address)) alreadyVoted;

	/// (votingPeriod/refreshNonce => (proposerGovernor => (uint)))
	/// number of votes a proposedGovernor has in the current period
	mapping(uint256 => mapping(address => uint32)) numOfVotesForGovernor;

	event GovernanceOwnershipTransferred(
		address indexed previousOwner,
		address indexed newOwner,
		uint256 timestamp,
		uint32 indexed refreshNonce
	);
	event RecoveredAddress(address indexed recovered);

	constructor(address _governor, uint32 _refreshNonce) {
		governor = _governor;
		refreshNonce = _refreshNonce;
		lastGovernorUpdateTime = block.timestamp;
		emit GovernanceOwnershipTransferred(address(0), _governor, block.timestamp, refreshNonce);
	}

	/// @notice Throws if called by any account other than the owner.
	modifier onlyGovernor() {
		require(msg.sender == governor, "Governable: caller is not the governor");
		_;
	}

	/// @notice Checks if its a valid time to vote.
	modifier isValidTimeToVote() {
		// Check block time stamp is some length greater than the last time
		// ownership transferred
		require(
			block.timestamp >
				lastGovernorUpdateTime +
					((sessionLengthMultiplier * averageSessionLengthInMillisecs) / 1000),
			"Governable: Invalid time for vote"
		);
		_;
	}

	/// @notice Checks if the vote nonces are valid.
	modifier areValidVotes(Vote[] memory votes) {
		for (uint i = 0; i < votes.length; i++) {
			require(votes[i].nonce == refreshNonce, "Governable: Nonce of vote must match refreshNonce");
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
		voterMerkleRoot = bytes32(0);
		averageSessionLengthInMillisecs = 1 << (64 - 1);
		voterCount = 0;
		refreshNonce++;
		governor = address(0);
		emit GovernanceOwnershipTransferred(governor, address(0), block.timestamp, refreshNonce);
	}

	/// @notice Transfers ownership of the contract to a new account (`newOwner`).
	/// @param newOwner The new owner of the contract.
	/// @param nonce The nonce of the proposal.
	/// @notice Can only be called by the current owner.
	function transferOwnership(address newOwner, uint32 nonce) public onlyGovernor {
		_transferOwnership(newOwner);
		refreshNonce = nonce;
	}

	/// @notice Transfers ownership of the contract to a new account associated with the publicKey
	///			and update other storage values relevant to the emergency voting process.
	/// @param _voterMerkleRoot The new voter merkle root.
	/// @param _averageSessionLengthInMillisecs The new average session length in milliseconds.
	/// @param _voterCount The new number of voters.
	/// @param _nonce The nonce of the proposal.
	/// @param _publicKey The public key of the new governor.
	/// @param _sig The signature of the propsal data.
	function transferOwnershipWithSignature(
		bytes32 _voterMerkleRoot,
		uint64 _averageSessionLengthInMillisecs,
		uint32 _voterCount,
		uint32 _nonce,
		bytes memory _publicKey,
		bytes memory _sig
	) public {
		require(_nonce == refreshNonce + 1, "Governable: Nonce must increment by 1");
		require(_averageSessionLengthInMillisecs > 0, "Governable: Invalid session length");
		bytes32 pubKeyHash = keccak256(_publicKey);
		address newOwner = address(uint160(uint256(pubKeyHash)));
		require(
			isSignatureFromGovernor(
				abi.encodePacked(
					_voterMerkleRoot,
					_averageSessionLengthInMillisecs,
					_voterCount,
					_nonce,
					_publicKey
				),
				_sig
			),
			"Governable: caller is not the governor"
		);
		voterMerkleRoot = _voterMerkleRoot;
		averageSessionLengthInMillisecs = _averageSessionLengthInMillisecs;
		voterCount = _voterCount;
		_transferOwnership(newOwner);
	}

	/// @notice Casts a vote in favor of force refreshing the governor
	/// @param vote A vote struct
	function voteInFavorForceSetGovernor(Vote memory vote)
		external
		isValidTimeToVote
		areValidVotes(arrayifyVote(vote))
	{
		// Check merkle proof is valid
		address proposerAddress = msg.sender;
		require(
			_isValidMerkleProof(vote.siblingPathNodes, proposerAddress, vote.leafIndex),
			"Governable: Invalid merkle proof"
		);

		_processVote(vote, proposerAddress);
	}

	/// @notice Casts a vote in favor of force refreshing the governor with a signature
	/// @param votes Vote structs
	/// @param sigs Signatures of the votes
	function voteInFavorForceSetGovernorWithSig(
		Vote[] memory votes,
		bytes[] memory sigs
	)
		external
		isValidTimeToVote
		areValidVotes(votes)
	{
		require(votes.length == sigs.length, "Governable: Invalid number of votes and signatures");
		for (uint i = 0; i < votes.length; i++) {
			// Recover the address from the signature
			address proposerAddress = recover(abi.encode(votes[i]), sigs[i]);

			// Check merkle proof is valid
			bool isValid = _isValidMerkleProof(votes[i].siblingPathNodes, proposerAddress, votes[i].leafIndex);
			if (isValid) {
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
	}

	/// @notice Process a vote
	/// @param vote A vote struct
	/// @param voter The address of the voter
	function _processVote(Vote memory vote, address voter) internal returns (bool) {
		// If the proposer has already voted, remove their previous vote
		if (alreadyVoted[vote.nonce][voter] != address(0x0)) {
			address previousVote = alreadyVoted[vote.nonce][voter];
			numOfVotesForGovernor[vote.nonce][previousVote] -= 1;
		}
		// Update the vote mappings
		alreadyVoted[vote.nonce][voter] = vote.proposedGovernor;
		numOfVotesForGovernor[vote.nonce][vote.proposedGovernor] += 1;
		// Try to resolve the vote if enough votes for a proposed governor have been cast.
		// Note: `voterCount` is also assumed to be the maximum # of voters in the system.
		// Therefore, if `voterCount / 2` votes are in favor of a new governor, we can
		// safely assume that there is no other governor that has more votes.
		if (numOfVotesForGovernor[vote.nonce][vote.proposedGovernor] > voterCount / 2) {
			_transferOwnership(vote.proposedGovernor);
			// If we transferred ownership, we return true to indicate the election is over.
			return true;
		}

		return false;
	}

	/// @notice Checks a merkle proof given a leaf and merkle path of sibling nodes.
	/// @param siblingPathNodes the path of sibling nodes of the Merkle proof
	/// @param leaf the leaf to prove membership of in the Merkle tree
	/// @param leafIndex the index of the leaf in the Merkle tree
	function _isValidMerkleProof(
		bytes32[] memory siblingPathNodes,
		address leaf,
		uint32 leafIndex
	) internal view returns (bool) {
		require(siblingPathNodes.length == getVoterMerkleTreeDepth(), "Governable: Invalid merkle proof length");
		bytes32 leafHash = keccak256(abi.encodePacked(leaf));
		bytes32 currNodeHash = leafHash;
		uint32 nodeIndex = leafIndex;
		for (uint8 i = 0; i < siblingPathNodes.length; i++) {
			if (nodeIndex % 2 == 0) {
				currNodeHash = keccak256(abi.encodePacked(currNodeHash, siblingPathNodes[i]));
			} else {
				currNodeHash = keccak256(abi.encodePacked(siblingPathNodes[i], currNodeHash));
			}
			nodeIndex = nodeIndex / 2;
		}
		return voterMerkleRoot == currNodeHash;
	}

	/// @notice Transfers ownership of the contract to a new account (`newOwner`).
	/// @param newOwner The new owner of the contract
	function _transferOwnership(address newOwner) internal {
		require(newOwner != address(0), "Governable: New governor is the zero address");
		address previousGovernor = governor;
		governor = newOwner;
		lastGovernorUpdateTime = block.timestamp;
		refreshNonce++;
		emit GovernanceOwnershipTransferred(previousGovernor, newOwner, lastGovernorUpdateTime, refreshNonce);
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
	/// @param _nonce The nonce of the proposal
	/// @param _leafIndex The leaf index of the vote
	/// @param _proposedGovernor The proposed governor
	/// @param _siblingPathNodes The sibling path nodes of the vote
	/// @return Vote The vote struct
	function createVote(
		uint32 _nonce,
		uint32 _leafIndex,
		address _proposedGovernor,
		bytes32[] memory _siblingPathNodes
	) public pure returns (Vote memory) {
		return Vote(_nonce, _leafIndex, _proposedGovernor, _siblingPathNodes);
	}

	/// @notice Helper function to return the depth of the voter merkle tree.
	/// @return uint8 The depth of the voter merkle tree
	/// @notice It is assumed that the number of voters never exceeds 4096.
	function getVoterMerkleTreeDepth() public view returns (uint8) {
		if (voterCount <= 2) {
			return 1;
		} else if (voterCount <= 4) {
			return 2;
		} else if (voterCount <= 8) {
			return 3;
		} else if (voterCount <= 16) {
			return 4;
		} else if (voterCount <= 32) {
			return 5;
		} else if (voterCount <= 64) {
			return 6;
		} else if (voterCount <= 128) {
			return 7;
		} else if (voterCount <= 256) {
			return 8;
		} else if (voterCount <= 512) {
			return 9;
		} else if (voterCount <= 1024) {
			return 10;
		} else if (voterCount <= 2048) {
			return 11;
		} else {
			return 12;
		}
	}
}
