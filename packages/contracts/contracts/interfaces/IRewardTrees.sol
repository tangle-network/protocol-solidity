/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

interface IRewardTrees {
  function lastProcessedDepositLeaf() external view returns (uint256);

  function lastProcessedWithdrawalLeaf() external view returns (uint256);

  function depositRoot() external view returns (uint256);

  function withdrawalRoot() external view returns (uint256);

  function deposits(uint256 i) external view returns (uint256);

  function withdrawals(uint256 i) external view returns (uint256);

  function registerDeposit(address instance, bytes32 commitment) external;

  function registerWithdrawal(address instance, bytes32 nullifier) external;
}