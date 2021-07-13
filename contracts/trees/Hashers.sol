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

interface IPoseidonT3 {
    function poseidon(uint256[2] memory input) external pure returns (uint256);
}

contract PoseidonT3Hasher is IHasher {
    IPoseidonT3 public immutable hasher;

    constructor (IPoseidonT3 _hasher) {
      hasher = _hasher;
    }

    function hash(uint256 in_xL, uint256 in_xR, uint256 key) external override view returns (uint256 xL, uint256 xR) {
        uint256 _hash = IPoseidonT3(hasher).poseidon([in_xL, in_xR]);
        return (_hash, 0);
    }
}

contract MiMCSponge220 is IHasher {
    function hash(uint256 in_xL, uint256 in_xR, uint256 key) external override view returns (uint256 xL, uint256 xR) {
        return (0, 0);
    }
}