/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "./MerkleTreeWithHistory.sol";

contract MerkleTree is MerkleTreeWithHistory {
	constructor(uint32 _levels, IHasher _hasher) {
		require(_levels > 0, "_levels should be greater than zero");
		require(_levels < 32, "_levels should be less than 32");
		levels = _levels;
		hasher = _hasher;

		for (uint32 i = 0; i < _levels; i++) {
			filledSubtrees[i] = uint256(hasher.zeros(i));
		}

		roots[0] = Root(uint256(hasher.zeros(_levels - 1)), 0);
	}
}
