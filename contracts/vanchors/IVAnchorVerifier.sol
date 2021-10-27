/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

interface IVAnchorVerifier {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    bytes memory input,
    uint8 maxEdges
  ) external view returns (bool r);
}

interface IVAnchorVerifier2 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[9] memory input
  ) external view returns (bool r);
}

interface IVAnchorVerifier3 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[10] memory input
  ) external view returns (bool r);
}

interface IVAnchorVerifier4 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[11] memory input
  ) external view returns (bool r);
}

interface IVAnchorVerifier5 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[12] memory input
  ) external view returns (bool r);
}

interface IVAnchorVerifier6 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[13] memory input
  ) external view returns (bool r);
}
