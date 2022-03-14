/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../trees/MerkleTreePoseidon.sol";
import "../interfaces/IAnchorVerifier.sol";
import "../interfaces/ILinkableAnchor.sol";
import "./LinkableTree.sol";

/**
	@title AnchorBase contract
	@notice Base contract for interoperable anchors. Each anchor base
	is a LinkableTree which allows it to be connected to other LinkableTrees.
 */
abstract contract AnchorBase is LinkableTree {
	IAnchorVerifier public verifier;
	uint32 proposalNonce = 0;

	// map to store used nullifier hashes
	mapping(bytes32 => bool) public nullifierHashes;
	// map to store all commitments to prevent accidental deposits with the same commitment
	mapping(bytes32 => bool) public commitments;

	event Insertion(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);

	/**
		@notice The constructor
		@param _handler The address of AnchorHandler for this contract
		@param _verifier The address of SNARK verifier for this contract
		@param _hasher The address of hash contract
		@param _merkleTreeHeight The height of deposits' Merkle Tree
		@param _maxEdges The maximum number of edges in the LinkableTree + Verifier supports.
		@notice The `_maxEdges` is zero-knowledge circuit dependent, meaning the
		`_verifier` ONLY supports a certain maximum # of edges. Therefore we need to
		limit the size of the LinkableTree with this parameter.
	*/
	constructor(
		address _handler,
		IAnchorVerifier _verifier,
		IPoseidonT3 _hasher,
		uint32 _merkleTreeHeight,
		uint8 _maxEdges
	) LinkableTree(_handler, _hasher, _merkleTreeHeight, _maxEdges) {
		verifier = _verifier;
	}

	/**
		@notice Inserts a commitment into the tree
		@notice This is an internal function and meant to be used by a child contract.
		@param _commitment The note commitment = Poseidon(chainId, nullifier, secret)
		@return uint32 The index of the inserted commitment
	*/
	function insert(bytes32 _commitment) internal returns(uint32) {
		require(!commitments[_commitment], "The commitment has been submitted");

		uint32 insertedIndex = _insert(_commitment);
		commitments[_commitment] = true;
		emit Insertion(_commitment, insertedIndex, block.timestamp);

		return insertedIndex;
	}

	/**
		@notice Inserts two commitments into the tree. Useful for contracts
		that need to insert two commitments at once.
		@notice This is an internal function and meant to be used by a child contract.
		@param _firstCommitment The first note commitment
		@param _secondCommitment The second note commitment
		@return uint32 The index of the first inserted commitment
	 */
	function insertTwo(bytes32 _firstCommitment, bytes32 _secondCommitment) internal returns(uint32) {
		require(!commitments[_firstCommitment], "The commitment has been submitted");
		require(!commitments[_secondCommitment], "The commitment has been submitted");

		uint32 insertedIndex = _insertTwo(_firstCommitment, _secondCommitment);
		commitments[_firstCommitment] = true;
		commitments[_secondCommitment] = true;
		emit Insertion(_firstCommitment, insertedIndex, block.timestamp);
		emit Insertion(_secondCommitment, insertedIndex + 1, block.timestamp);

		return insertedIndex;
	}

	/**
		@notice Verifies a zero-knowledge proof of knowledge over the tree according
		to the underlying `Verifier` circuit this `AnchorBase` is using.
		@notice This aims to be as generic as currently needed to support our
		FixedDepositAnchor and VAnchor (variable deposit) contracts.
		@param _proof The zero-knowledge proof bytes
		@param _input The public input packed bytes
		@return bool Whether the proof is valid
	 */
	function verify(
		bytes memory _proof,
		bytes memory _input
	) internal view returns (bool) {
		uint256[8] memory p = abi.decode(_proof, (uint256[8]));
		(
				uint256[2] memory a,
				uint256[2][2] memory b,
				uint256[2] memory c
		) = unpackProof(p);
		bool r = verifier.verifyProof(
			a, b, c,
			_input,
			maxEdges,
			true
		);
		require(r, "Invalid withdraw proof");
		return r;
	}

	/**
		@notice A helper function to convert an array of 8 uint256 values into the a, b,
		and c array values that the zk-SNARK verifier's verifyProof accepts.
		@param _proof The array of 8 uint256 values
		@return (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) The unpacked proof values
	*/
	function unpackProof(
			uint256[8] memory _proof
	) public pure returns (
			uint256[2] memory,
			uint256[2][2] memory,
			uint256[2] memory
	) {
		return (
			[_proof[0], _proof[1]],
			[
				[_proof[2], _proof[3]],
				[_proof[4], _proof[5]]
			],
			[_proof[6], _proof[7]]
		);
	}

	/**
		@notice Whether a note is already spent
		@param _nullifierHash The nullifier hash of the deposit note
		@return bool Whether the note is already spent
	*/
	function isSpent(bytes32 _nullifierHash) public view returns (bool) {
		return nullifierHashes[_nullifierHash];
	}

	/**
		@notice Whether an array of notes is already spent
		@param _nullifierHashes The array of nullifier hashes of the deposit notes
		@return bool[] An array indicated whether each note's nullifier hash is already spent
	*/
	function isSpentArray(bytes32[] calldata _nullifierHashes) external view returns (bool[] memory) {
		bool[] memory spent = new bool[](_nullifierHashes.length);
		for (uint256 i = 0; i < _nullifierHashes.length; i++) {
			if (isSpent(_nullifierHashes[i])) {
				spent[i] = true;
			}
		}

		return spent;
	}

	/**
		@notice Set a new handler with a nonce
		@dev Can only be called by the `AnchorHandler` contract
		@param _handler The new handler address
		@param _nonce The nonce for updating the new handler
	 */
	function setHandler(address _handler, uint32 _nonce) onlyHandler external {
		require(_handler != address(0), "Handler cannot be 0");
		require(proposalNonce < _nonce, "Invalid nonce");
		require(_nonce <= proposalNonce + 1, "Nonce must increment by 1");
		handler = _handler;
		proposalNonce = _nonce;
	}

	/**
		@notice Set a new verifier with a nonce
		@dev Can only be called by the `AnchorHandler` contract
		@param _verifier The new verifier address
		@param _nonce The nonce for updating the new verifier
	 */
	function setVerifier(address _verifier, uint32 _nonce) onlyHandler external {
		require(_verifier != address(0), "Handler cannot be 0");
		require(proposalNonce < _nonce, "Invalid nonce");
		require(_nonce <= proposalNonce + 1, "Nonce must increment by 1");
		verifier = IAnchorVerifier(_verifier);
		proposalNonce = _nonce;
	}

	/**
		@notice Gets the proposal nonce of this contract
		@dev The nonce tracks how many times the handler has updated the contract
	 */
	function getProposalNonce() public view returns (uint32) {
		return proposalNonce;
	}
}
