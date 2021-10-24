/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

interface ISemaphoreVerifier {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    bytes memory input,
    uint8 maxEdges
  ) external view returns (bool r);
}

interface ISemaphoreVerifier2 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[4] memory input
  ) external view returns (bool r);
}

interface ISemaphoreVerifier3 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[5] memory input
  ) external view returns (bool r);
}

interface ISemaphoreVerifier4 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[6] memory input
  ) external view returns (bool r);
}

interface ISemaphoreVerifier5 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[7] memory input
  ) external view returns (bool r);
}

interface ISemaphoreVerifier6 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[8] memory input
  ) external view returns (bool r);
}
