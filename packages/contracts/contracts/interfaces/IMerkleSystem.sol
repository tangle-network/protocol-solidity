/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "../utils/Initialized.sol";
import "../hashers/IHasher.sol";

/**
    @title IMerkleSystem contract for merkle tree like data structures.
    @author Webb Technologies
 */
interface IMerkleSystem {
	/** @dev Whether the root is present in the root history of the system */
	function isKnownRoot(uint256 root) external view returns (bool);

	/** @dev Gets the zero hash for a specific index */
	function getZeroHash(uint32 index) external view returns (uint256);

	/** @dev Gets the levels of the outer-most merkle tree in the system */
	function getLevels() external view returns (uint32);

	/** @dev Gets the last merkle root of the merkle system */
	function getLastRoot() external view returns (uint256);

	/** @dev Gets the next index of a subtree */
	function getNextIndex() external view returns (uint32);

	/** @dev Gets the hasher for this merkle system */
	function getHasher() external view returns (IHasher);
}

abstract contract MerkleSystem is IMerkleSystem, Initialized {
	uint256 public constant FIELD_SIZE =
		21888242871839275222246405745257275088548364400416034343698204186575808495617;
	uint256 public constant ZERO_VALUE =
		21663839004416932945382355908790599225266501822907911457504978515578255421292; // = keccak256("tornado") % FIELD_SIZE
	uint32 public constant ROOT_HISTORY_SIZE = 30;

	// The `Root` struct is used to store the root and the index of
	// the leaf triggering this root update.
	struct Root {
		uint256 root;
		uint32 latestLeafindex;
	}

	// The mapping of root indices to roots for storing a history of ROOT_HISTORY_SIZE updates
	mapping(uint256 => Root) public roots;
	// The mapping of filled subtree indices to filled subtree roots
	mapping(uint256 => uint256) public filledSubtrees;
	// The mapping to store used nullifier hashes / spent commitments
	mapping(uint256 => bool) public nullifierHashes;
	// The mapping to store all commitments to prevent accidental deposits with the same commitment
	mapping(uint256 => bool) public commitments;

	event Insertion(
		uint256 indexed commitment,
		uint32 leafIndex,
		uint256 timestamp,
		uint256 indexed newMerkleRoot
	);

	// Internal functions
	function _initialize() internal {
		initialized = true;
	}

	/** @dev this function is defined in a child contract */
	function hashLeftRight(uint256 _left, uint256 _right) public view virtual returns (uint256) {
		IHasher hasher = this.getHasher();
		return hasher.hashLeftRight(_left, _right);
	}

	function _insert(uint256 element) internal virtual returns (uint32 index);

	function _insertTwo(uint256 left, uint256 right) internal virtual returns (uint32 index);

	function _insertTwo(uint256[2] memory elements) internal returns (uint32 index) {
		return _insertTwo(elements[0], elements[1]);
	}
}
