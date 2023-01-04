/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

interface IHasher {
  function poseidon(bytes32[2] calldata inputs) external pure returns (bytes32);

  function poseidon(bytes32[3] calldata inputs) external pure returns (bytes32);
}