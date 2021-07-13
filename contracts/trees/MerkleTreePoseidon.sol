/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";

contract MerkleTreeMiMC is MerkleTreeWithHistory {
  constructor(uint32 _levels, IHasher _hasher) MerkleTreeWithHistory(_levels, _hasher) {
    for (uint32 i = 0; i < _levels; i++) {
      filledSubtrees[i] = zeros(i);
    }

    roots[0] = zeros(_levels - 1);
  }

  /**
    @dev Hash 2 tree leaves, returns MiMC(_left, _right)
  */
  function hashLeftRight(
    IHasher _hasher,
    bytes32 _left,
    bytes32 _right
  ) override public pure returns (bytes32) {
    require(uint256(_left) < FIELD_SIZE, "_left should be inside the field");
    require(uint256(_right) < FIELD_SIZE, "_right should be inside the field");
    uint256 left = uint256(_left);
    uint256 right = uint256(_right);
    (left, right) = _hasher.hash(left, right, 0);
    return bytes32(left);
  }

  /// @dev provides Zero (Empty) elements for a MiMC MerkleTree. Up to 32 levels
  function zeros(uint256 i) override public pure returns (bytes32) {
    return 0;
  }
}