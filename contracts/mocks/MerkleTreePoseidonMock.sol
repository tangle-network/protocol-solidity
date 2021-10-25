// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../trees/MerkleTreePoseidon.sol";
import "../trees/Hasher.sol";

contract MerkleTreePoseidonMock is MerkleTreePoseidon {
  constructor(uint32 _treeLevels, IPoseidonT3 _hasher) MerkleTreePoseidon(_treeLevels, _hasher) {}

  function insert(bytes32 _leaf) public {
    _insert(_leaf);
  }
}