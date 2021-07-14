// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../trees/MerkleTreeWithHistory.sol";

contract HasherMock is IHasher {
  function MiMCSponge(uint256 in_xL, uint256 in_xR, uint256 key) override external pure returns (uint256 xL, uint256 xR) {
    return (in_xL, in_xR);
  }
}