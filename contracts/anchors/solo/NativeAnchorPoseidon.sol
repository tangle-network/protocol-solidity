/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

pragma solidity ^0.8.0;

import "./AnchorPoseidon.sol";

contract NativeAnchorPoseidon is AnchorPoseidon {
  constructor(
    IVerifier _verifier,
    IPoseidonT3 _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight
  ) AnchorPoseidon(_verifier, _hasher, _denomination, _merkleTreeHeight) {}

  function _processDeposit() internal override {
    require(msg.value == denomination, "Please send `mixDenomination` ETH along with transaction");
  }

  function _processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal override {
    // sanity checks
    require(msg.value == 0, "Message value is supposed to be zero for ETH instance");
    require(_refund == 0, "Refund value is supposed to be zero for ETH instance");

    (bool success, ) = _recipient.call{ value: denomination - _fee }("");
    require(success, "payment to _recipient did not go thru");
    if (_fee > 0) {
      (success, ) = _relayer.call{ value: _fee }("");
      require(success, "payment to _relayer did not go thru");
    }
  }
}