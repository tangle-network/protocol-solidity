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
  using SafeMath for uint256;

  address public governor;
  address[] public tokens;
  mapping (address => bool) valid;

  bool public isNativeAllowed;
  uint256 public wrappingLimit;
  uint public storageNonce = 0;

  constructor(string memory name, string memory symbol, address _governor, uint256 _limit, bool _isNativeAllowed) TokenWrapper(name, symbol) {
    governor = _governor;
    wrappingLimit = _limit;
    isNativeAllowed = _isNativeAllowed;
  }

  function setGovernor(address _governor) public onlyGovernor {
    governor = _governor;
  }

  function setNativeAllowed(bool _isNativeAllowed) public onlyGovernor {
    isNativeAllowed = _isNativeAllowed;
  }
      
  function add(address tokenAddress, uint nonce) public onlyGovernor {
    require(!valid[tokenAddress], "Token should not be valid");
    require(storageNonce < nonce, "Invalid nonce");
    tokens.push(tokenAddress);
    valid[tokenAddress] = true;
    storageNonce = nonce;
  }

  function updateLimit(uint256 limit) public onlyGovernor {
    wrappingLimit = limit;
  }

  function setFee(uint8 _feePercentage, uint nonce) override external onlyGovernor {
    require(0 <= _feePercentage && _feePercentage <= 100, "invalid fee percentage");
    require(storageNonce < nonce, "Invalid nonce");
    feePercentage = _feePercentage;
    storageNonce = nonce;
  }

  function _isValidAddress(address tokenAddress) override internal virtual returns (bool) {
    return valid[tokenAddress];
  }

  function _isValidAmount(uint256 amount) override internal virtual returns (bool) {
    return amount + this.totalSupply() <= wrappingLimit;
  }

  function _isNativeValid() override internal virtual returns (bool) {
    return isNativeAllowed;
  }

  function getTokens() external view returns (address[] memory) {
    return tokens;
  }

  modifier onlyGovernor() {
    require(msg.sender == governor, "Only governor can call this function");
    _;
  }
}
