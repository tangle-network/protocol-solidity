/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IMASPInstance.sol";
import "../interfaces/IRewardTrees.sol";

contract RewardProxy {
  using SafeERC20 for IERC20;

  event EncryptedNote(address indexed sender, bytes encryptedNote);
  event InstanceStateUpdated(IMASPInstance indexed instance, InstanceState state);
  event RewardTreesUpdated(IRewardTrees addr);

  enum InstanceState { DISABLED, ENABLED, MINEABLE }

  struct Instance {
    bool isERC20;
    IERC20 token;
    InstanceState state;
  }

  struct Reward {
    IMASPInstance addr;
    Instance instance;
  }

  IRewardTrees public rewardTrees;
  address public immutable governance;
  mapping(IMASPInstance => Instance) public instances;

  modifier onlyGovernance() {
    require(msg.sender == governance, "Not authorized");
    _;
  }

  constructor(
    address _rewardTrees,
    address _governance,
    Reward[] memory _instances
  ) {
    rewardTrees = IRewardTrees(_rewardTrees);
    governance = _governance;

    for (uint256 i = 0; i < _instances.length; i++) {
      _updateInstance(_instances[i]);
    }
  }

  function deposit(
    IMASPInstance _masp,
    bytes32 _commitment,
    bytes calldata _encryptedNote
  ) public payable virtual {
    Instance memory instance = instances[_masp];
    require(instance.state != InstanceState.DISABLED, "The instance is not supported");

    if (instance.isERC20) {
      instance.token.safeTransferFrom(msg.sender, address(this), _masp.denomination());
    }
    _masp.deposit{ value: msg.value }(_commitment);

    if (instance.state == InstanceState.MINEABLE) {
      rewardTrees.registerDeposit(address(_masp), _commitment);
    }
    emit EncryptedNote(msg.sender, _encryptedNote);
  }

  function withdraw(
    IMASPInstance _masp,
    bytes calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) public payable virtual {
    Instance memory instance = instances[_masp];
    require(instance.state != InstanceState.DISABLED, "The instance is not supported");

    _masp.withdraw{ value: msg.value }(_proof, _root, _nullifierHash, _recipient, _relayer, _fee, _refund);
    if (instance.state == InstanceState.MINEABLE) {
      rewardTrees.registerWithdrawal(address(_masp), _nullifierHash);
    }
  }

  function backupNotes(bytes[] calldata _encryptedNotes) external virtual {
    for (uint256 i = 0; i < _encryptedNotes.length; i++) {
      emit EncryptedNote(msg.sender, _encryptedNotes[i]);
    }
  }

  function updateInstance(Reward calldata _masp) external virtual onlyGovernance {
    _updateInstance(_masp);
  }

  function setRewardTreesContract(IRewardTrees _rewardTrees) external virtual onlyGovernance {
    rewardTrees = _rewardTrees;
    emit RewardTreesUpdated(_rewardTrees);
  }

  /// @dev Method to claim junk and accidentally sent tokens
  function rescueTokens(
    IERC20 _token,
    address payable _to,
    uint256 _amount
  ) external virtual onlyGovernance {
    require(_to != address(0), "TORN: can not send to zero address");

    if (_token == IERC20(address(0))) {
      // for Ether
      uint256 totalBalance = address(this).balance;
      uint256 balance = Math.min(totalBalance, _amount);
      _to.transfer(balance);
    } else {
      // any other erc20
      uint256 totalBalance = _token.balanceOf(address(this));
      uint256 balance = Math.min(totalBalance, _amount);
      require(balance > 0, "TORN: trying to send 0 balance");
      _token.safeTransfer(_to, balance);
    }
  }

  function _updateInstance(Reward memory _masp) internal {
    instances[_masp.addr] = _masp.instance;
    if (_masp.instance.isERC20) {
      IERC20 token = IERC20(_masp.addr.token());
      require(token == _masp.instance.token, "Incorrect token");
      uint256 allowance = token.allowance(address(this), address(_masp.addr));

      if (_masp.instance.state != InstanceState.DISABLED && allowance == 0) {
        token.safeApprove(address(_masp.addr), type(uint256).max);
      } else if (_masp.instance.state == InstanceState.DISABLED && allowance != 0) {
        token.safeApprove(address(_masp.addr), 0);
      }
    }
    emit InstanceStateUpdated(_masp.addr, _masp.instance.state);
  }
}