/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./TokenWrapper.sol";

/**
	@title A governed TokenWrapper system using an external `governor` address
	@author Webb Technologies.
	@notice Governs allowable ERC20s to deposit using a governable wrapping limit and
	sets fees for wrapping into itself. This contract is intended to be used with
	TokenHandler contract.
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

	/**
		@notice GovernedTokenWrapper constructor
		@param _name The name of the ERC20 TokenWrapper
		@param _symbol The symbol of the ERC20 TokenWrapper
		@param _feeRecipient The recipient for fees from wrapping.
		@param _governor The address of the governor
		@param _limit The maximum amount of tokens that can be wrapped
		@param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
	 */
	constructor(
		string memory _name,
		string memory _symbol,
		address payable _feeRecipient,
		address _governor,
		uint256 _limit,
		bool _isNativeAllowed
	) TokenWrapper(_name, _symbol, _feeRecipient) {
		governor = _governor;
		wrappingLimit = _limit;
		isNativeAllowed = _isNativeAllowed;
	}

	/**
		@notice Sets the governor of the GovernedTokenWrapper contract
		@param _governor The address of the new governor
		@notice Only the governor can call this function
	 */
	function setGovernor(address _governor) public onlyGovernor {
		governor = _governor;
	}

	/**
		@notice Sets whether native tokens are allowed to be wrapped
		@param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
		@notice Only the governor can call this function
	 */
	function setNativeAllowed(bool _isNativeAllowed) public onlyGovernor {
		isNativeAllowed = _isNativeAllowed;
	}

	/**
		@notice Adds a token at `_tokenAddress` to the GovernedTokenWrapper's wrapping list
		@param _tokenAddress The address of the token to be added
		@param _nonce The nonce tracking updates to this contract
		@notice Only the governor can call this function
	 */
	function add(address _tokenAddress, uint256 _nonce) public onlyGovernor {
		require(!valid[_tokenAddress], "Token should not be valid");
		require(proposalNonce < _nonce, "Invalid nonce");
		require(_nonce <= proposalNonce + 1, "Nonce must increment by 1");
		tokens.push(_tokenAddress);

		if (!historicallyValid[_tokenAddress]) {
			historicalTokens.push(_tokenAddress);
			historicallyValid[_tokenAddress] = true;
		}
		valid[_tokenAddress] = true;
		proposalNonce = _nonce;
	}

	/**
		@notice Removes a token at `_tokenAddress` from the GovernedTokenWrapper's wrapping list
		@param _tokenAddress The address of the token to be removed
		@param _nonce The nonce tracking updates to this contract
		@notice Only the governor can call this function
	 */
	function remove(address _tokenAddress, uint256 _nonce) public onlyGovernor {
		require(valid[_tokenAddress], "Token should be valid");
		require(proposalNonce < _nonce, "Invalid nonce");
		require(_nonce <= proposalNonce + 1, "Nonce must increment by 1");
		uint index = 0;
		for (uint i = 0; i < tokens.length; i++) {
			if (tokens[i] == _tokenAddress) {
				index = i;
				break;
			}
		}
		require(index < tokens.length, "token not found");
		valid[_tokenAddress] = false;
		proposalNonce = _nonce;
		removeTokenAtIndex(index);
	}

	/**
		@notice Removes a token at `_index` from the GovernedTokenWrapper's wrapping list
		@param _index The index of the token to be removed
	 */
	function removeTokenAtIndex(uint _index) internal {
		tokens[_index] = tokens[tokens.length-1];
		tokens.pop();
	}

	/**
		@notice Updates the `_limit` of tokens that can be wrapped
		@param _limit The new limit of tokens that can be wrapped
		@notice Only the governor can call this function
	 */
	function updateLimit(uint256 _limit) public onlyGovernor {
		wrappingLimit = _limit;
	}

	/**
		@notice Sets a new `_feePercentage` for the GovernedTokenWrapper
		@param _feePercentage The new fee percentage
		@param _nonce The nonce tracking updates to this contract
		@notice Only the governor can call this function
	 */
	function setFee(uint8 _feePercentage, uint256 _nonce) override external onlyGovernor {
		require(0 <= _feePercentage && _feePercentage <= 100, "invalid fee percentage");
		require(proposalNonce < _nonce, "Invalid nonce");
		require(_nonce <= proposalNonce + 1, "Nonce must increment by 1");
		feePercentage = _feePercentage;
		proposalNonce = _nonce;
	}

	/**
		@notice Sets a new `_feeRecipient` for the GovernedTokenWrapper
		@param _feeRecipient The new fee recipient
		@param _nonce The nonce tracking updates to this contract
		@notice Only the governor can call this function
	 */
	function setFeeRecipient(address payable _feeRecipient, uint256 _nonce) public onlyGovernor {
		require(proposalNonce < _nonce, "Invalid nonce");
		require(_nonce <= proposalNonce + 1, "Nonce must increment by 1");
		require(_feeRecipient != address(0), "Fee Recipient cannot be zero address");
		feeRecipient = _feeRecipient;
		proposalNonce = _nonce;
	}

	/**
		@notice Gets the current fee percentage
		@return uint8 The fee percentage
	 */
	function getFee() view external returns (uint8) {
		return feePercentage;
	}

	/**
		@notice Checks if the token at `tokenAddress` is valid (i.e. if it's in the wrapping list)
		@return bool Whether or not the token is valid
	 */
	function _isValidAddress(address tokenAddress) override internal virtual returns (bool) {
		return valid[tokenAddress];
	}
	
	/**
		@notice Checks if the token at `tokenAddress` is historically valid
		(i.e. if it was in the wrapping list at any point in history).
		@param _tokenAddress The address of the token to be checked
		@return bool Whether or not the token is historically valid
	 */
	function _isValidHistoricalAddress(address _tokenAddress) override internal virtual returns (bool) {
		return historicallyValid[_tokenAddress];
	}

	/**
		@notice Checks if an amount of the underlying token can be wrapped or if the limit has been reached
		@param _amount The amount of the underlying token to be wrapped
		@return bool Whether or not the amount can be wrapped
	 */
	function _isValidAmount(uint256 _amount) override internal virtual returns (bool) {
		return _amount + this.totalSupply() <= wrappingLimit;
	}

	/**
		@notice Checks if the native token is allowed to be wrapped
		@return bool Whether or not the native token is allowed to be wrapped
	 */
	function _isNativeValid() override internal virtual returns (bool) {
		return isNativeAllowed;
	}

	/**
		@notice Gets the currently available wrappable tokens by their addresses
		@return address[] The currently available wrappable token addresses
	 */
	function getTokens() external view returns (address[] memory) {
		return tokens;
	}

	/**
		@notice Modifier for enforcing that the caller is the governor
	 */
	modifier onlyGovernor() {
		require(msg.sender == governor, "Only governor can call this function");
		_;
	}
}
