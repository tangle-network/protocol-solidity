// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IAnchorTreesV1 {
  function lastProcessedDepositLeaf() external view returns (uint256);

  function lastProcessedWithdrawalLeaf() external view returns (uint256);

  function depositRoot() external view returns (bytes32);

  function withdrawalRoot() external view returns (bytes32);

  function deposits(uint256 i) external view returns (bytes32);

  function withdrawals(uint256 i) external view returns (bytes32);

  function registerDeposit(address instance, bytes32 commitment) external;

  function registerWithdrawal(address instance, bytes32 nullifier) external;
}
