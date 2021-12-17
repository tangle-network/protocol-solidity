/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./TokenWrapper.sol";
import "../utils/Governable.sol";

/**
    @title Governs allowable ERC20s to deposit using a governable wrapping limit.
    @author Webb Technologies.
    @notice This contract is intended to be used with ERC20Handler contract.
 */
contract SignatureGovernedTokenWrapper is TokenWrapper, Governable {
  using SafeMath for uint256;

  address[] public tokens;
  mapping (address => bool) valid;

  bool public isNativeAllowed;
  uint256 public wrappingLimit;

  constructor(string memory name, string memory symbol, address _governor, uint256 _limit, bool _isNativeAllowed) TokenWrapper(name, symbol) Governable(_governor) {
    wrappingLimit = _limit;
    isNativeAllowed = _isNativeAllowed;
  }
  
  modifier signedByGovernorAdd(bytes memory data, bytes memory sig) {
    bytes memory prefix = "\x19Ethereum Signed Message:\n72";
    require(isSignatureFromGovernor(abi.encodePacked(prefix, data), sig), "signed by governor: Not valid sig from governor");
    _;
  }

  modifier signedByGovernorFee(bytes memory data, bytes memory sig) {
    bytes memory prefix = "\x19Ethereum Signed Message:\n72";
    require(isSignatureFromGovernor(abi.encodePacked(prefix, data), sig), "signed by governor: Not valid sig from governor");
    _;
  }

  function setNativeAllowed(bool _isNativeAllowed) public onlyGovernor {
    isNativeAllowed = _isNativeAllowed;
  }

  function add(address tokenAddress) public onlyGovernor {
    require(!valid[tokenAddress], "Token should not be valid");
    tokens.push(tokenAddress);
    valid[tokenAddress] = true;
  }

  function addWithSignature (address tokenAddress, bytes memory sig) public signedByGovernorAdd(abi.encodePacked(tokenAddress), sig){
    require(!valid[tokenAddress], "Token should not be valid");
    tokens.push(tokenAddress);
    valid[tokenAddress] = true;
  }

  function updateLimit(uint256 limit) public onlyGovernor {
    wrappingLimit = limit;
  }

  function setFee(uint8 _feePercentage) override external onlyGovernor {
    require(0 <= _feePercentage && _feePercentage <= 100, "invalid fee percentage");
    feePercentage = _feePercentage;
  }

  function setFeeWithSignature(uint8 _feePercentage, bytes memory sig) external signedByGovernorFee(abi.encodePacked(_feePercentage), sig) {
    require(0 <= _feePercentage && _feePercentage <= 100, "invalid fee percentage");
    feePercentage = _feePercentage;
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
}
