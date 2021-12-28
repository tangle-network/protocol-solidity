/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

interface IVerifier2 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[9] memory input
  ) external view returns (bool r);
}

interface IVerifier3 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[10] memory input
  ) external view returns (bool r);
}

interface IVerifier4 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[11] memory input
  ) external view returns (bool r);
}

interface IVerifier5 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[12] memory input
  ) external view returns (bool r);
}

interface IVerifier6 {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint256[13] memory input
  ) external view returns (bool r);
}
