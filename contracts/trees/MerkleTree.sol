/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";

contract MerkleTree is MerkleTreeWithHistory {
    constructor(uint32 _levels, IHasher _hasher) {
        require(_levels > 0, "_levels should be greater than zero");
        require(_levels < 32, "_levels should be less than 32");
        levels = _levels;
        hasher = _hasher;

        for (uint32 i = 0; i < _levels; i++) {
            filledSubtrees[i] = hasher.zeros(i);
        }

        roots[0] = Root(hasher.zeros(_levels - 1), 0);
    }

    /**
        @dev Hash 2 tree leaves
    */
    function hashLeftRight(
        IHasher _hasher,
        bytes32 _left,
        bytes32 _right
    ) override public view returns (bytes32) {
        return bytes32(_hasher.hashLeftRight(uint256(_left), uint256(_right)));
    }
}
