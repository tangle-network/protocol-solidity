/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "../hashers/IHasher.sol";
import "../interfaces/IMerkleSystem.sol";

abstract contract MerkleTreeWithHistory is MerkleSystem {
	uint32 public currentRootIndex = 0;
	uint32 public nextIndex = 0;
	uint32 public levels;

	IHasher public hasher;

	/// @inheritdoc IMerkleSystem
	function getLastRoot() public view override returns (uint256) {
		return roots[currentRootIndex].root;
	}

	/// @inheritdoc IMerkleSystem
	function getZeroHash(uint32 index) external view override returns (uint256) {
		return uint256(hasher.zeros(index));
	}

	/// @inheritdoc IMerkleSystem
	function getLevels() external view override returns (uint32) {
		return levels;
	}

	/// @inheritdoc IMerkleSystem
	function getNextIndex() external view override returns (uint32) {
		return nextIndex;
	}

	/// @inheritdoc IMerkleSystem
	function getHasher() external view override returns (IHasher) {
		return hasher;
	}

	/// @inheritdoc IMerkleSystem
	function isKnownRoot(uint256 _root) public view override returns (bool) {
		if (_root == 0) {
			return false;
		}
		uint32 _currentRootIndex = currentRootIndex;
		uint32 i = _currentRootIndex;
		do {
			if (_root == roots[i].root) {
				return true;
			}
			if (i == 0) {
				i = ROOT_HISTORY_SIZE;
			}
			i--;
		} while (i != _currentRootIndex);
		return false;
	}

	function _insert(uint256 _leaf) internal override returns (uint32 index) {
		uint32 _nextIndex = nextIndex;
		require(
			_nextIndex != uint32(2) ** levels,
			"Merkle tree is full. No more leaves can be added"
		);
		uint32 currentIndex = _nextIndex;
		uint256 currentLevelHash = _leaf;
		uint256 left;
		uint256 right;

		for (uint32 i = 0; i < levels; i++) {
			if (currentIndex % 2 == 0) {
				left = currentLevelHash;
				right = uint256(hasher.zeros(i));
				filledSubtrees[i] = currentLevelHash;
			} else {
				left = filledSubtrees[i];
				right = currentLevelHash;
			}
			currentLevelHash = hashLeftRight(left, right);
			currentIndex /= 2;
		}

		uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
		currentRootIndex = newRootIndex;
		nextIndex = _nextIndex + 1;
		roots[newRootIndex] = Root(currentLevelHash, nextIndex);
		return _nextIndex;
	}

	// Modified to insert pairs of leaves for better efficiency
	// Disclaimer: using this function assumes both leaves are siblings.
	function _insertTwo(uint256 _leaf1, uint256 _leaf2) internal override returns (uint32 index) {
		uint32 _nextIndex = nextIndex;
		require(
			_nextIndex != uint32(2) ** levels,
			"Merkle tree is full. No more leaves can be added"
		);
		uint32 currentIndex = _nextIndex / 2;
		uint256 currentLevelHash = hashLeftRight(_leaf1, _leaf2);
		uint256 left;
		uint256 right;
		for (uint32 i = 1; i < levels; i++) {
			if (currentIndex % 2 == 0) {
				left = currentLevelHash;
				right = uint256(hasher.zeros(i));
				filledSubtrees[i] = currentLevelHash;
			} else {
				left = filledSubtrees[i];
				right = currentLevelHash;
			}
			currentLevelHash = hashLeftRight(left, right);
			currentIndex /= 2;
		}

		uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
		currentRootIndex = newRootIndex;
		nextIndex = _nextIndex + 2;
		roots[newRootIndex] = Root(currentLevelHash, nextIndex);
		return _nextIndex;
	}
}
