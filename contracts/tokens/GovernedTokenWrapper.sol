/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./TokenWrapper.sol";

/**
        @title Governs allowable ERC20s to deposit using a governable wrapping limit.
        @author Webb Technologies.
        @notice This contract is intended to be used with TokenHandler contract.
 */
contract GovernedTokenWrapper is TokenWrapper {
    using SafeMath for uint256;

    address public governor;
    address[] public tokens;
    address[] public historicalTokens;
    mapping (address => bool) valid;
    mapping (address => bool) historicallyValid;

    bool public isNativeAllowed;
    uint256 public wrappingLimit;
    uint256 public proposalNonce = 0;

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

    function add(address tokenAddress, uint256 nonce) public onlyGovernor {
        require(!valid[tokenAddress], "Token should not be valid");
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce <= proposalNonce + 1, "Nonce must increment by 1");
        tokens.push(tokenAddress);

        if (!historicallyValid[tokenAddress]) {
            historicalTokens.push(tokenAddress);
            historicallyValid[tokenAddress] = true;
        }
        valid[tokenAddress] = true;
        proposalNonce = nonce;
    }

    function remove(address tokenAddress, uint256 nonce) public onlyGovernor {
        require(valid[tokenAddress], "Token should be valid");
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce <= proposalNonce + 1, "Nonce must increment by 1");
        uint index = 0;
        for (uint i = 0; i < tokens.length; i++) {
            if (tokens[i] == tokenAddress) {
                index = i;
                break;
            }
        }
        require(index < tokens.length, "token not found");
        valid[tokenAddress] = false;
        proposalNonce = nonce;
        removeTokenAtIndex(index);
    }

    function removeTokenAtIndex(uint index) internal {
        tokens[index] = tokens[tokens.length-1];
        tokens.pop();
    }

    function updateLimit(uint256 limit) public onlyGovernor {
        wrappingLimit = limit;
    }

    function setFee(uint8 _feePercentage, uint256 nonce) override external onlyGovernor {
        require(0 <= _feePercentage && _feePercentage <= 100, "invalid fee percentage");
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce <= proposalNonce + 1, "Nonce must increment by 1");
        feePercentage = _feePercentage;
        proposalNonce = nonce;
    }

    function setFeeRecipient(address payable _feeRecipient, uint256 nonce) public onlyGovernor {
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce <= proposalNonce + 1, "Nonce must increment by 1");
        require(_feeRecipient != address(0), "Fee Recipient cannot be zero address");
        feeRecipient = _feeRecipient;
        proposalNonce = nonce;
    }

    function getFee() view external returns (uint8) {
        return feePercentage;
    }

    function _isValidAddress(address tokenAddress) override internal virtual returns (bool) {
        return valid[tokenAddress];
    }
    
    function _isValidHistoricalAddress(address tokenAddress) override internal virtual returns (bool) {
        return historicallyValid[tokenAddress];
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
