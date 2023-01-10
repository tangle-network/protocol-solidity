/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MerkleTreeWithHistory.sol";

contract OwnableMerkleTree is Ownable, MerkleTreeWithHistory {
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

  function insert(uint256 _leaf) external onlyOwner returns (uint32 index) {
    return _insert(_leaf);
  }
}