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
  address[] tokens;
  mapping (address => bool) valid;

  constructor(string memory name, string memory symbol)
    TokenWrapper(name, symbol) {}

  /** @dev this function is defined in a child contract */
  function _isValid(address tokenAddress) override internal virtual returns (bool) {
    return valid[tokenAddress];
  }

  function add(address tokenAddress) public onlyThis {
    require(!valid[tokenAddress], "Token not already be valid");
    tokens.push(tokenAddress);
    valid[tokenAddress] = true;
  }

  modifier onlyThis() {
    if (msg.sender == address(this)) {
      _;
    }
  }
}
