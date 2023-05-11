/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "./TokenWrapper.sol";
import "../interfaces/tokens/IFungibleTokenWrapper.sol";
import "../utils/Initialized.sol";
import "../utils/ProposalNonceTracker.sol";

/**
    @title A governed TokenWrapper system using an external `handler` address
    @author Webb Technologies.
    @notice Governs allowable ERC20s to deposit using a governable wrapping limit and
    sets fees for wrapping into itself. This contract is intended to be used with
    TokenHandler contract.
 */
contract FungibleTokenWrapper is
	Initialized,
	TokenWrapper,
	IFungibleTokenWrapper,
	ProposalNonceTracker
{
	address public handler;
	address[] public tokens;
	address[] public historicalTokens;

	mapping(address => bool) public valid;
	mapping(address => bool) public historicallyValid;

	bool public isNativeAllowed;
	uint256 public wrappingLimit;

	event HandlerUpdated(address _handler);

	/**
        @notice FungibleTokenWrapper constructor
        @param _name The name of the ERC20 TokenWrapper
        @param _symbol The symbol of the ERC20 TokenWrapper
     */
	constructor(string memory _name, string memory _symbol) TokenWrapper(_name, _symbol) {}

	/**
        @notice FungibleTokenWrapper initializer
        @param _feePercentage The fee percentage for wrapping
        @param _feeRecipient The recipient for fees from wrapping.
        @param _handler The address of the handler
        @param _limit The maximum amount of tokens that can be wrapped
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
		@param _admin The address of the admin who will receive minting rights and admin role
     */
	function initialize(
		uint16 _feePercentage,
		address _feeRecipient,
		address _handler,
		uint256 _limit,
		bool _isNativeAllowed,
		address _admin
	) public onlyUninitialized {
		require(
			_feeRecipient != address(0),
			"FungibleTokenWrapper: Fee Recipient Address can't be 0"
		);
		require(_handler != address(0), "FungibleTokenWrapper: Handler Address can't be 0");
		require(_admin != address(0), "FungibleTokenWrapper: Admin Address can't be 0");
		super._initialize(_admin);
		initialized = true;
		feePercentage = _feePercentage;
		feeRecipient = payable(_feeRecipient);
		handler = _handler;
		wrappingLimit = _limit;
		isNativeAllowed = _isNativeAllowed;
	}

	/**
        @notice Sets the handler of the FungibleTokenWrapper contract
        @param _handler The address of the new handler
        @notice Only the handler can call this function
     */
	function setHandler(address _handler) public onlyHandler {
		require(_handler != address(0), "FungibleTokenWrapper: Handler Address can't be 0");
		handler = _handler;
		emit HandlerUpdated(_handler);
	}

	/**
        @notice Sets whether native tokens are allowed to be wrapped
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
        @notice Only the handler can call this function
     */
	function setNativeAllowed(bool _isNativeAllowed) public onlyHandler {
		isNativeAllowed = _isNativeAllowed;
	}

	/**
        @notice Adds a token at `_tokenAddress` to the FungibleTokenWrapper's wrapping list
        @param _tokenAddress The address of the token to be added
        @param _nonce The nonce tracking updates to this contract
        @notice Only the handler can call this function
     */
	function add(
		address _tokenAddress,
		uint32 _nonce
	) external override onlyHandler onlyIncrementingByOne(_nonce) {
		require(!valid[_tokenAddress], "FungibleTokenWrapper: Token should not be valid");
		tokens.push(_tokenAddress);

		if (!historicallyValid[_tokenAddress]) {
			historicalTokens.push(_tokenAddress);
			historicallyValid[_tokenAddress] = true;
		}
		valid[_tokenAddress] = true;
	}

	/**
        @notice Removes a token at `_tokenAddress` from the FungibleTokenWrapper's wrapping list
        @param _tokenAddress The address of the token to be removed
        @param _nonce The nonce tracking updates to this contract
        @notice Only the handler can call this function
     */
	function remove(
		address _tokenAddress,
		uint32 _nonce
	) external override onlyHandler onlyIncrementingByOne(_nonce) {
		require(valid[_tokenAddress], "FungibleTokenWrapper: Token should be valid");
		uint index = 0;
		for (uint i = 0; i < tokens.length; i++) {
			if (tokens[i] == _tokenAddress) {
				index = i;
				break;
			}
		}
		require(index < tokens.length, "FungibleTokenWrapper: Token not found");
		valid[_tokenAddress] = false;
		removeTokenAtIndex(index);
	}

	/**
        @notice Sets a new `_feePercentage` for the FungibleTokenWrapper
        @param _feePercentage The new fee percentage
        @param _nonce The nonce tracking updates to this contract
        @notice Only the handler can call this function
     */
	function setFee(
		uint16 _feePercentage,
		uint32 _nonce
	) external override onlyHandler onlyIncrementingByOne(_nonce) {
		require(_feePercentage < 10_000, "FungibleTokenWrapper: Invalid fee percentage");
		feePercentage = _feePercentage;
	}

	/**
        @notice Sets a new `_feeRecipient` for the FungibleTokenWrapper
        @param _feeRecipient The new fee recipient
        @param _nonce The nonce tracking updates to this contract
        @notice Only the handler can call this function
     */
	function setFeeRecipient(
		address payable _feeRecipient,
		uint32 _nonce
	) external override onlyHandler onlyIncrementingByOne(_nonce) {
		require(
			_feeRecipient != address(0),
			"FungibleTokenWrapper: Fee Recipient cannot be zero address"
		);
		feeRecipient = _feeRecipient;
	}

	/**
        @notice Removes a token at `_index` from the FungibleTokenWrapper's wrapping list
        @param _index The index of the token to be removed
     */
	function removeTokenAtIndex(uint _index) internal {
		tokens[_index] = tokens[tokens.length - 1];
		tokens.pop();
	}

	/**
        @notice Updates the `_limit` of tokens that can be wrapped
        @param _limit The new limit of tokens that can be wrapped
        @notice Only the handler can call this function
     */
	function updateLimit(uint256 _limit) public onlyHandler {
		wrappingLimit = _limit;
	}

	/**
        @notice Gets the current fee percentage
        @return uint16 The fee percentage
     */
	function getFee() external view returns (uint16) {
		return feePercentage;
	}

	/**
        @notice Checks if the token at `tokenAddress` is valid (i.e. if it's in the wrapping list)
        @return bool Whether or not the token is valid
     */
	function _isValidAddress(address tokenAddress) internal view virtual override returns (bool) {
		return valid[tokenAddress];
	}

	/**
        @notice Checks if the token at `tokenAddress` is historically valid
        (i.e. if it was in the wrapping list at any point in history).
        @param _tokenAddress The address of the token to be checked
        @return bool Whether or not the token is historically valid
     */
	function _isValidHistoricalAddress(
		address _tokenAddress
	) internal view virtual override returns (bool) {
		return historicallyValid[_tokenAddress];
	}

	/**
        @notice Checks if an amount of the underlying token can be wrapped or if the limit has been reached
        @param _amount The amount of the underlying token to be wrapped
        @return bool Whether or not the amount can be wrapped
     */
	function _isValidAmount(uint256 _amount) internal view virtual override returns (bool) {
		return _amount + this.totalSupply() <= wrappingLimit;
	}

	/**
        @notice Checks if the native token is allowed to be wrapped
        @return bool Whether or not the native token is allowed to be wrapped
     */
	function _isNativeValid() internal view virtual override returns (bool) {
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
        @notice Modifier for enforcing that the caller is the handler
     */
	modifier onlyHandler() {
		require(msg.sender == handler, "FungibleTokenWrapper: Only handler can call this function");
		_;
	}
}
