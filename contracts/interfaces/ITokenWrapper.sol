/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
    @title Interface for Token Wrapper contract.
    @author Webb Technologies.
 */
interface ITokenWrapper {
  function wrap(address tokenAddress, uint256 amount) payable external;
  function unwrap(address tokenAddress, uint256 amount) external;
  function unwrapAndSendTo(address tokenAddress, uint256 amount, address recipient) external;
  function wrapFor(address sender, address tokenAddress, uint256 amount) payable external;
  function wrapForAndSendTo(address sender, address tokenAddress, uint256 amount, address mintRecipient) payable external;
  function unwrapFor(address sender, address tokenAddress, uint256 amount) external;
  function getFeeFromAmount(uint amountToWrap) external view returns (uint);
  function setFee(uint8 feePercentage) external;
}
