/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 
pragma solidity ^0.8.0;

import "./TokenWrapper.sol";

/**
    @title Manages deposited ERC20s.
    @author Webb Technologies.
    @notice This contract is intended to be used with ERC20Handler contract.
 */
contract TCRTokenWrapper is TokenWrapper {
  address governor;
  address[] tokens;
  mapping (address => bool) valid;

  constructor(string memory name, string memory symbol) TokenWrapper(name, symbol) {
    governor = msg.sender;
  }

  function setGovernor(address _governor) public onlyGovernor {
    governor = _governor;
  }

  /** @dev this function is defined in a child contract */
  function _isValid(address tokenAddress) override internal virtual returns (bool) {
    return valid[tokenAddress];
  }

  function add(address tokenAddress) public onlyGovernor {
    require(!valid[tokenAddress], "Token not already be valid");
    tokens.push(tokenAddress);
    valid[tokenAddress] = true;
  }

  modifier onlyGovernor() {
    if (msg.sender == governor) {
      _;
    }
  }
}
