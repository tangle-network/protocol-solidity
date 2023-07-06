/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @param leafIndex leafIndex of the proposer in the proposer set Merkle tree
/// @param siblingPathNodes Merkle proof path of sibling nodes
/// @param proposedGovernor the governor that the voter wants to force reset to
struct Vote {
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
	uint64 public averageSessionLengthInMillisecs = 2 ** 64 - 1;

	/// The session length multiplier (see the voteInFavorForceSetGovernor function below)
	uint256 public sessionLengthMultiplier = 2;

	/// The number of proposers
	uint32 public voterCount;

	/// The current voting period
	uint256 public currentVotingPeriod = 0;

	/// (currentVotingPeriod => (proposer => (vote of new governor))) whether a proposer has
	/// voted in this period and who they're voting for
	mapping(uint256 => mapping(address => address)) alreadyVoted;

	/// (currentVotingPeriod => (proposerGovernor => (uint))) number of votes a
	/// proposedGovernor has in the current period
	mapping(uint256 => mapping(address => uint32)) numOfVotesForGovernor;

	event GovernanceOwnershipTransferred(
		address indexed previousOwner,
		address indexed newOwner,
		uint256 timestamp
	);
	event RecoveredAddress(address indexed recovered);

	constructor(address _governor, uint32 _refreshNonce) {
		governor = _governor;
		refreshNonce = _refreshNonce;
		lastGovernorUpdateTime = block.timestamp;
		emit GovernanceOwnershipTransferred(address(0), _governor, block.timestamp);
	}

	/// @notice Throws if called by any account other than the owner.
	modifier onlyGovernor() {
		require(isGovernor(), "Governable: caller is not the governor");
		_;
	}

	/// @notice Checks if its a valid time to vote.
	modifier isValidTimeToVote() {
		// Check block time stamp is some length greater than the last time
		// ownership transferred
		require(
			block.timestamp >=
				lastGovernorUpdateTime +
					((sessionLengthMultiplier * averageSessionLengthInMillisecs) / 1000),
			"Governable: Invalid time for vote"
		);
		_;
	}

	/// @notice Returns true if the caller is the current owner.
	/// @return bool Whether the `msg.sender` is the governor
	function isGovernor() public view returns (bool) {
		return msg.sender == governor;
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
		refreshNonce = refreshNonce + 1;
		governor = address(0);
		emit GovernanceOwnershipTransferred(governor, address(0), block.timestamp);
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
		require(refreshNonce < _nonce, "Governable: Invalid nonce");
		require(_nonce <= refreshNonce + 1, "Governable: Nonce must increment by 1");
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
		refreshNonce = _nonce;
		_transferOwnership(newOwner);
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

	/// @notice Transfers ownership of the contract to a new account (`newOwner`).
	/// @param newOwner The new owner of the contract
	function _transferOwnership(address newOwner) internal {
		require(newOwner != address(0), "Governable: New governor is the zero address");
		address previousGovernor = governor;
		governor = newOwner;
		lastGovernorUpdateTime = block.timestamp;
		currentVotingPeriod++;
		emit GovernanceOwnershipTransferred(previousGovernor, newOwner, lastGovernorUpdateTime);
	}

	/// @notice Helper function for creating a vote struct
	/// @param _leafIndex The leaf index of the vote
	/// @param _proposedGovernor The proposed governor
	/// @param _siblingPathNodes The sibling path nodes of the vote
	/// @return Vote The vote struct
	function createVote(
		uint32 _leafIndex,
		address _proposedGovernor,
		bytes32[] memory _siblingPathNodes
	) public pure returns (Vote memory) {
		return Vote(_leafIndex, _proposedGovernor, _siblingPathNodes);
	}

	/// @notice Casts a vote in favor of force refreshing the governor
	/// @param vote A vote struct
	function voteInFavorForceSetGovernor(Vote memory vote) external isValidTimeToVote {
		require(
			vote.proposedGovernor != address(0x0),
			"Governable: Proposed governor cannot be the zero address"
		);

		address proposerAddress = msg.sender;
		// Check merkle proof is valid
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
	) external isValidTimeToVote {
		require(votes.length == sigs.length, "Governable: Invalid number of votes and signatures");
		for (uint i = 0; i < votes.length; i++) {
			require(
				votes[i].proposedGovernor != address(0x0),
				"Governable: Proposed governor cannot be the zero address"
			);
			// Recover the address from the signature
			address proposerAddress = recover(abi.encode(votes[i]), sigs[i]);

			// Check merkle proof is valid
			if (
				_isValidMerkleProof(votes[i].siblingPathNodes, proposerAddress, votes[i].leafIndex)
			) {
				_processVote(votes[i], proposerAddress);
			}
		}
	}

	/// @notice Process a vote
	/// @param vote A vote struct
	/// @param voter The address of the voter
	function _processVote(Vote memory vote, address voter) internal {
		// If the proposer has already voted, remove their previous vote
		if (alreadyVoted[currentVotingPeriod][voter] != address(0x0)) {
			address previousVote = alreadyVoted[currentVotingPeriod][voter];
			numOfVotesForGovernor[currentVotingPeriod][previousVote] -= 1;
		}

		alreadyVoted[currentVotingPeriod][voter] = vote.proposedGovernor;
		numOfVotesForGovernor[currentVotingPeriod][vote.proposedGovernor] += 1;
		_tryResolveVote(vote.proposedGovernor);
	}

	/// @notice Tries and resolves the vote by checking the number of votes for
	/// a proposed governor is greater than voterCount/2.
	/// @param proposedGovernor the address to transfer ownership to, if the vote passes
	function _tryResolveVote(address proposedGovernor) internal {
		if (numOfVotesForGovernor[currentVotingPeriod][proposedGovernor] > voterCount / 2) {
			_transferOwnership(proposedGovernor);
		}
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
}
