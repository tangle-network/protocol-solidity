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
  struct WrapAndDepositInput {
      address tokenAddress;
      uint256 amount;
  }
  
  function wrap(address sender, address tokenAddress, uint256 amount) external;
  function unwrap(address sender, address tokenAddress, uint256 amount) external;
  function wrapAndDeposit(address sender, WrapAndDepositInput memory input) external;
  function withdrawAndUnwrap(address sender, address tokenAddress, uint256 amount) external;
  function isValidAddress(address tokenAddress) external returns (bool);
  function isValidAmount(uint256 amount) external returns (bool);

}