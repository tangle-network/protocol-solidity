/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 
pragma solidity ^0.8.0;

import "./TokenWrapper.sol";

/**
    @title Governs allowable ERC20s to deposit using a governable wrapping limit.
    @author Webb Technologies.
    @notice This contract is intended to be used with ERC20Handler contract.
 */
contract GovernedTokenWrapper is TokenWrapper {
  address public governor;
  address[] public tokens;
  mapping (address => bool) valid;

  uint256 public wrappingLimit;

  constructor(string memory name, string memory symbol, address _governor, uint256 _limit) TokenWrapper(name, symbol) {
    governor = _governor;
    wrappingLimit = _limit;
  }

  function setGovernor(address _governor) public onlyGovernor {
    governor = _governor;
  }

  function _isValidAddress(address tokenAddress) override internal virtual returns (bool) {
    return valid[tokenAddress];
  }

  function _isValidAmount(uint256 amount) override internal virtual returns (bool) {
    return amount + this.totalSupply() <= wrappingLimit;
  }

  function add(address tokenAddress) public onlyGovernor {
    require(!valid[tokenAddress], "Token should not be valid");
    tokens.push(tokenAddress);
    valid[tokenAddress] = true;
  }

  function updateLimit(uint256 limit) public onlyGovernor {
    wrappingLimit = limit;
  }

  function getTokens() external view returns (address[] memory) {
    return tokens;
  }

  modifier onlyGovernor() {
    require(msg.sender == governor, "Only governor can call this function");
    _;
  }
}
