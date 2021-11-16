/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../interfaces/ITokenWrapper.sol";
import "../interfaces/IMintableERC20.sol";
import "./LinkableVAnchor.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VAnchor is LinkableVAnchor {
  using SafeERC20 for IERC20;
  address public immutable token;

  constructor(
    IVAnchorVerifier _verifier,
    uint32 _levels,
    address _hasher,
    address _token,
    PermissionedAccounts memory _permissions,
    uint8 _maxEdges
  ) LinkableVAnchor(
    _verifier,
    _levels,
    _hasher,
    _permissions,
    _maxEdges
  ) {token = _token;}

  function _processDeposit(uint256 _extAmount) internal override {
    require(msg.value == 0, "ETH value is supposed to be 0 for ERC20 instance");
    IMintableERC20(token).transferFrom(msg.sender, address(this), _extAmount);
  }

  function _processWithdraw(
    address _recipient,
    uint256 _minusExtAmount
  ) internal override {

    uint balance = IERC20(token).balanceOf(address(this));
    if (balance >= _minusExtAmount) {
      // transfer tokens when balance exists
      IERC20(token).safeTransfer(_recipient, _minusExtAmount);
    } else {
      // mint tokens when not enough balance exists
      IMintableERC20(token).mint(_recipient, _minusExtAmount);
    }
  }

  function _processFee(
    address  _relayer,
    uint256 _fee
  ) internal override {
    uint balance = IERC20(token).balanceOf(address(this));
    if (_fee > 0) {
      if (balance >= _fee) {
        // transfer tokens when balance exists
        IERC20(token).safeTransfer(_relayer, _fee);
      }
      else {
        IMintableERC20(token).mint(_relayer, _fee);
      }
    }
  }
}
