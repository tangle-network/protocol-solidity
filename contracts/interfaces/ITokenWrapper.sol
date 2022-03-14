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
	/**
		@notice Wraps an `amount` of tokens from `tokenAddress`
		@param _tokenAddress Address of the token to wrap
		@param _amount Amount of tokens to wrap
	 */
	function wrap(address _tokenAddress, uint256 _amount) payable external;

	/**
		@notice Unwraps an `amount` of an underlying token into the token at `tokenAddress`
		@param _tokenAddress Address of the token to unwrap into
		@param _amount Amount of tokens to unwrap
	 */
	function unwrap(address _tokenAddress, uint256 _amount) external;

	/**
		@notice Unwraps an `amount` of an underlying token into the token at `tokenAddress`
		and sends to a `recipient` address
		@param _tokenAddress Address of the token to unwrap into
		@param _amount Amount of tokens to unwrap
		@param _recipient Address of the recipient
	 */
	function unwrapAndSendTo(address _tokenAddress, uint256 _amount, address _recipient) external;

	/**
		@notice Wraps an `amount` of tokens from `tokenAddress` for the `sender`
		@param _sender The sender address the tokens are being wrapped for
		@param _tokenAddress Address of the token to wrap
		@param _amount Amount of tokens to wrap
	 */
	function wrapFor(address _sender, address _tokenAddress, uint256 _amount) payable external;

	/**
		@notice Wraps an `amount of tokens from `tokenAddress` for the `sender` address and sends to a `_mintRecipient` 
		@param _sender The sender address the tokens are being wrapped for
		@param _tokenAddress Address of the token to wrap
		@param _amount Amount of tokens to wrap
		@param _mintRecipient Address of the recipient of the wrapped tokens
	 */
	function wrapForAndSendTo(address _sender, address _tokenAddress, uint256 _amount, address _mintRecipient) payable external;

	/**
		@notice Unwraps an `amount` of an underlying token into the token at `tokenAddress` for a `sender`
		@param _sender The sender address the tokens are being unwrapped for
		@param _tokenAddress Address of the token to unwrap into
		@param _amount Amount of tokens to unwrap
	 */
	function unwrapFor(address _sender, address _tokenAddress, uint256 _amount) external;

	/**
		@notice Gets the fee for an `_amountToWrap` amount of tokens
		@param _amountToWrap Amount of tokens to wrap
		@return uint256 The fee amount for the `_amountToWrap` amount of tokens
	 */
	function getFeeFromAmount(uint _amountToWrap) external view returns (uint);

	/**
		@notice Gets the amount to wrap for an exact `_deposit` amount of tokens. This
		function calculates the amount needed to wrap inclusive of the fee that will
		be charged from `getFeeFromAmount` to meet the `_deposit` amount
		@param _deposit Amount of tokens needed for the deposit to be valid
	 */
	function getAmountToWrap(uint _deposit) external view returns (uint);

	/**
		@notice Sets the `_feePercentage` to be taken from wrappings with a `_nonce`
		@param _feePercentage The percentage of the fee to be taken from the wrapping
		@param _nonce The nonce for tracking fee updates
	 */
	function setFee(uint8 _feePercentage, uint256 _nonce) external;
}
