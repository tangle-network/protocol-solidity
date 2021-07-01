/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";

contract PoseidonT3 {
    function poseidon(uint256[2] memory input) public pure returns (uint256) {
        return 0;
    }
}

contract PoseidonT4 {
    function poseidon(uint256[3] memory input) public pure returns (uint256) {
        return 0;
    }
}

contract PoseidonT5 {
    function poseidon(uint256[4] memory input) public pure returns (uint256) {
        return 0;
    }
}

contract PoseidonT6 {
    function poseidon(uint256[5] memory input) public pure returns (uint256) {
        return 0;
    }
}

contract MiMCSponge220 is IHasher {
    function hash(uint256 in_xL, uint256 in_xR) external override pure returns (uint256 xL, uint256 xR) {
        return (0, 0);
    }
}