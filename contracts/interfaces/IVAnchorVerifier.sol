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
    uint8 maxEdges,
    bool smallInputs
  ) external view returns (bool r);
}

interface IVAnchorVerifier2_2 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[9] memory input
  ) external view returns (bool r);
}

interface IVAnchorVerifier2_16 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[23] memory input
  ) external view returns (bool r);
}

interface IVAnchorVerifier8_2 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[15] memory input
  ) external view returns (bool r);
}

interface IVAnchorVerifier8_16 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[29] memory input
  ) external view returns (bool r);
}
