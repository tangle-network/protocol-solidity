// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../trees/MerkleTreeMiMC.sol";

contract MerkleTreeMiMCMock is MerkleTreeMiMC {
  constructor(uint32 _treeLevels, IHasher _hasher) MerkleTreeMiMC(_treeLevels, _hasher) {}

  function insert(bytes32 _leaf) public {
    _insert(_leaf);
  }
}