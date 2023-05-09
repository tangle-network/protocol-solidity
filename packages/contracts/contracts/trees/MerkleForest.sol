/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "./LinkableIncrementalBinaryTree.sol";
import "../interfaces/IMerkleSystem.sol";
import "../hashers/IHasher.sol";

contract MerkleForest is MerkleSystem {
	using LinkableIncrementalBinaryTree for LinkableIncrementalTreeData;
	IHasher public hasher;
	uint32 public currSubtreeIndex;
	uint32 public numSubtreeElements;

	uint32 public forestLevels;
	uint32 public subtreeLevels;

	/// @dev Gets a group id and returns the group/tree data.
	mapping(uint256 => LinkableIncrementalTreeData) public subtrees;
	LinkableIncrementalTreeData public merkleForest;

	// bytes32[] public leaves;
	constructor(uint32 _forestLevels, uint32 _subtreeLevels, IHasher _hasher) {
		require(_forestLevels > 0, "_forestLevels should be greater than zero");
		require(_subtreeLevels > 0, "_subtreeLevels should be greater than zero");
		require(_forestLevels < 32, "_forestLevels should be less than 32");
		require(_subtreeLevels < 32, "_subtreeLevels should be less than 32");

		for (uint32 i = 0; i < _forestLevels; i++) {
			subtrees[i].init(_subtreeLevels);
		}
		merkleForest.init(_forestLevels);

		hasher = _hasher;
		currSubtreeIndex = 0;
		numSubtreeElements = 0;
		forestLevels = _forestLevels;
		subtreeLevels = _subtreeLevels;
	}

	/**
        @dev inserts single leaf into subtree then update forest
    */
	function _insert(uint256 _leaf) internal override returns (uint32) {
		if (numSubtreeElements >= uint32(2 ** subtreeLevels)) {
			numSubtreeElements = 0;
			currSubtreeIndex += 1;
		}
		subtrees[currSubtreeIndex]._insert(uint(_leaf));
		uint newLeaf = subtrees[currSubtreeIndex].getLastRoot();
		merkleForest._update(currSubtreeIndex, 0, newLeaf);
		numSubtreeElements += 1;
		return numSubtreeElements;
	}

	/**
        @dev inserts pair of leaves into subtree then update forest
    */
	function _insertTwo(uint256 _leaf1, uint256 _leaf2) internal override returns (uint32) {
		if (numSubtreeElements + 1 >= uint32(2 ** subtreeLevels)) {
			numSubtreeElements = 0;
			currSubtreeIndex += 1;
		}
		uint32 index = subtrees[currSubtreeIndex]._insertTwo(uint(_leaf1), uint(_leaf2));
		uint newLeaf = subtrees[currSubtreeIndex].getLastRoot();
		merkleForest._update(currSubtreeIndex, 0, newLeaf);
		numSubtreeElements += 2;
		return index;
	}

	/**
        @dev inserts single leaf into specific subtreeId (if possible)
    */
	function _insertSubtree(uint32 _subtreeId, uint256 _leaf) internal returns (uint) {
		if (numSubtreeElements >= uint32(2 ** subtreeLevels)) {
			numSubtreeElements = 0;
			currSubtreeIndex += 1;
		}
		subtrees[_subtreeId]._insert(uint(_leaf));
		uint newLeaf = subtrees[_subtreeId].getLastRoot();
		merkleForest._update(_subtreeId, 0, newLeaf);
		return merkleForest.getLastRoot();
	}

	/**
        @dev Whether the root is present in any of the subtree's history
    */
	function isKnownSubtreeRoot(uint _subtreeId, uint256 _root) public view returns (bool) {
		return subtrees[_subtreeId].isKnownRoot(uint(_root));
	}

	/**
        @dev Whether the root is present in any of the subtree's history
    */
	function getLastSubtreeRoot(uint256 _subtreeId) public view returns (uint) {
		return subtrees[_subtreeId].getLastRoot();
	}

	/// @inheritdoc IMerkleSystem
	function isKnownRoot(uint256 _root) public view override returns (bool) {
		return merkleForest.isKnownRoot(uint256(_root));
	}

	/// @inheritdoc IMerkleSystem
	function getLastRoot() external view override returns (uint256) {
		return merkleForest.getLastRoot();
	}

	/// @inheritdoc IMerkleSystem
	function getZeroHash(uint32 index) external pure override returns (uint256) {
		return LinkableIncrementalBinaryTree.zeros(index);
	}

	/// @inheritdoc IMerkleSystem
	function getNextIndex() external view override returns (uint32) {
		return numSubtreeElements;
	}

	/// @inheritdoc IMerkleSystem
	function getLevels() external view override returns (uint32) {
		return forestLevels;
	}

	/// @inheritdoc IMerkleSystem
	function getHasher() external view override returns (IHasher) {
		return hasher;
	}
}
