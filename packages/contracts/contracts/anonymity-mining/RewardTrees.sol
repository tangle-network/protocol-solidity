/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../trees/MerkleTree.sol";
import "../trees/OwnableMerkleTree.sol";
import "../interfaces/IRewardTrees.sol";

contract RewardTrees is IRewardTrees {
  OwnableMerkleTree public immutable depositTree;
  OwnableMerkleTree public immutable withdrawalTree;
  IHasher public immutable hasher;
  address public immutable rewardProxy;

  uint256[] public override deposits;
  uint256 public override lastProcessedDepositLeaf;

  uint256[] public override withdrawals;
  uint256 public override lastProcessedWithdrawalLeaf;

  event DepositData(address instance, bytes32 indexed hash, uint256 block, uint256 index);
  event WithdrawalData(address instance, bytes32 indexed hash, uint256 block, uint256 index);

  struct TreeLeaf {
    address instance;
    bytes32 hash;
    uint256 block;
  }

  modifier onlyRewardProxy {
    require(msg.sender == rewardProxy, "Not authorized");
    _;
  }

  constructor(
    address _rewardProxy,
    IHasher _hasher2,
    IHasher _hasher3,
    uint32 _levels
  ) {
    rewardProxy = _rewardProxy;
    hasher = _hasher3;
    depositTree = new OwnableMerkleTree(_levels, _hasher2);
    withdrawalTree = new OwnableMerkleTree(_levels, _hasher2);
  }

  function registerDeposit(address _instance, bytes32 _commitment) external override onlyRewardProxy {
    deposits.push(uint256(keccak256(abi.encode(_instance, _commitment, blockNumber()))));
  }

  function registerWithdrawal(address _instance, bytes32 _nullifier) external override onlyRewardProxy {
    withdrawals.push(uint256(keccak256(abi.encode(_instance, _nullifier, blockNumber()))));
  }

  function updateRoots(TreeLeaf[] calldata _deposits, TreeLeaf[] calldata _withdrawals) external {
    if (_deposits.length > 0) updateDepositTree(_deposits);
    if (_withdrawals.length > 0) updateWithdrawalTree(_withdrawals);
  }

  function updateDepositTree(TreeLeaf[] calldata _deposits) public {
    uint256[] memory leaves = new uint256[](_deposits.length);
    uint256 offset = lastProcessedDepositLeaf;

    for (uint256 i = 0; i < _deposits.length; i++) {
      TreeLeaf memory deposit = _deposits[i];
      uint256 leafHash = uint256(keccak256(abi.encode(deposit.instance, deposit.hash, deposit.block)));
      require(deposits[offset + i] == leafHash, "Incorrect deposit");

      leaves[i] = hasher.hash3([uint256(uint160(deposit.instance)), uint256(deposit.hash), deposit.block]);
      delete deposits[offset + i];
      depositTree.insert(leaves[i]);

      emit DepositData(deposit.instance, deposit.hash, deposit.block, offset + i);
    }

    lastProcessedDepositLeaf = offset + _deposits.length;
    // TODO: bulkInsert
    //depositTree.bulkInsert(leaves);
  }

  function updateWithdrawalTree(TreeLeaf[] calldata _withdrawals) public {
    uint256[] memory leaves = new uint256[](_withdrawals.length);
    uint256 offset = lastProcessedWithdrawalLeaf;

    for (uint256 i = 0; i < _withdrawals.length; i++) {
      TreeLeaf memory withdrawal = _withdrawals[i];
      uint256 leafHash = uint256(keccak256(abi.encode(withdrawal.instance, withdrawal.hash, withdrawal.block)));
      require(withdrawals[offset + i] == leafHash, "Incorrect withdrawal");

      leaves[i] = hasher.hash3([uint256(uint160(withdrawal.instance)), uint256(withdrawal.hash), withdrawal.block]);
      delete withdrawals[offset + i];
      withdrawalTree.insert(leaves[i]);

      emit WithdrawalData(withdrawal.instance, withdrawal.hash, withdrawal.block, offset + i);
    }

    lastProcessedWithdrawalLeaf = offset + _withdrawals.length;
    // TODO: bulkInsert
    //withdrawalTree.bulkInsert(leaves);
  }

  function validateRoots(uint256 _depositRoot, uint256 _withdrawalRoot) public view {
    require(depositTree.isKnownRoot(_depositRoot), "Incorrect deposit tree root");
    require(withdrawalTree.isKnownRoot(_withdrawalRoot), "Incorrect withdrawal tree root");
  }

  function depositRoot() external override view returns (uint256) {
    return depositTree.getLastRoot();
  }

  function withdrawalRoot() external override view returns (uint256) {
    return withdrawalTree.getLastRoot();
  }

  function getRegisteredDeposits() external view returns (uint256[] memory _deposits) {
    uint256 count = deposits.length - lastProcessedDepositLeaf;
    _deposits = new uint256[](count);
    for (uint256 i = 0; i < count; i++) {
      _deposits[i] = deposits[lastProcessedDepositLeaf + i];
    }
  }

  function getRegisteredWithdrawals() external view returns (uint256[] memory _withdrawals) {
    uint256 count = withdrawals.length - lastProcessedWithdrawalLeaf;
    _withdrawals = new uint256[](count);
    for (uint256 i = 0; i < count; i++) {
      _withdrawals[i] = withdrawals[lastProcessedWithdrawalLeaf + i];
    }
  }

  function blockNumber() public view virtual returns (uint256) {
    return block.number;
  }
}