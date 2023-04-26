/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity ^0.8.18;

import "../trees/MerkleForest.sol";
import "../hashers/IHasher.sol";

contract MerkleForestMock is MerkleForest {
	constructor(
		uint32 _forestLevels,
		uint32 _subtreeLevels,
		IHasher _hasher
	) MerkleForest(_forestLevels, _subtreeLevels, _hasher) {}

	function insert(uint256 _leaf) public {
		_insert(_leaf);
	}

	function insertTwoTest(uint256 _leaf1, uint256 _leaf2) public {
		_insertTwo(_leaf1, _leaf2);
	}

	function insertTest(uint256 _leaf) public {
		_insert(_leaf);
	}

	function insertSubtreeTest(uint32 _subtreeId, uint256 _leaf) public {
		_insertSubtree(_subtreeId, _leaf);
	}
}
