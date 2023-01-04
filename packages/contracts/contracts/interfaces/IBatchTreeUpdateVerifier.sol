/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

interface IBatchTreeUpdateVerifier {
  function verifyProof(bytes calldata proof, uint256[1] calldata input) external view returns (bool);
}