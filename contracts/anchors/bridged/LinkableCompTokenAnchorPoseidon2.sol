/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../../tokens/TokenWrapper.sol";
import "./LinkableAnchorPoseidon2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LinkableCompTokenAnchorPoseidon2 is LinkableAnchorPoseidon2 {
  using SafeERC20 for IERC20;
  address public immutable token;

  constructor(
    IVerifier _verifier,
    IPoseidonT3 _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint32 _chainID,
    TokenWrapper _token
  ) LinkableAnchorPoseidon2(_verifier, _hasher, _denomination, _merkleTreeHeight, _chainID) {
    token = address(_token);
  }
  
  function wrap(address tokenAddress, uint256 amount) public {
    TokenWrapper(token).wrap(msg.sender, tokenAddress, amount);
  }

  function unwrap(address tokenAddress, uint256 amount) public {
    TokenWrapper(token).unwrap(msg.sender, tokenAddress, amount);
  }

  function _processDeposit() internal override {
    require(msg.value == 0, "ETH value is supposed to be 0 for ERC20 instance");
    IMintableCompToken(token).transferFrom(msg.sender, address(this), denomination);
  }

  function _processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal override {
    require(msg.value == _refund, "Incorrect refund amount received by the contract");

    if (IERC20(token).balanceOf(address(this)) == 0) {
      IMintableCompToken(token).mint(_recipient, denomination - _fee);
      if (_fee > 0) {
        IMintableCompToken(token).mint(_relayer, _fee);
      }
    } else {
      IERC20(token).safeTransfer(_recipient, denomination - _fee);
      if (_fee > 0) {
        IERC20(token).safeTransfer(_relayer, _fee);
      }
    }

    if (_refund > 0) {
      (bool success, ) = _recipient.call{ value: _refund }("");
      if (!success) {
        // let's return _refund back to the relayer
        _relayer.transfer(_refund);
      }
    }
  }
}
