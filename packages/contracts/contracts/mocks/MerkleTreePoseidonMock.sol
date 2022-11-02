// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../trees/MerkleTree.sol";
import "../trees/IHasher.sol";

contract MerkleTreePoseidonMock is MerkleTree {
    constructor(uint32 _treeLevels, IHasher _hasher) MerkleTree(_treeLevels, _hasher) {}

    function insert(bytes32 _leaf) public {
        _insert(_leaf);
    }
}