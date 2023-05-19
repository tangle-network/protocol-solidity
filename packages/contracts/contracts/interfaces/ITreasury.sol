/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/**
        @title Interface for Treasury contract.
        @author Webb Technologies.
 */
interface ITreasury {
	/**
        @notice Sends an `_amountToRescue` of tokens at `_tokenAddress` from the treasury contract to `_to`
        @param _tokenAddress Address of the token to rescue.
        @param _to Address of the recipient.
        @param _amountToRescue Amount of tokens to rescue.
        @param _nonce Nonce of the rescue transaction.
     */
	function rescueTokens(
		address _tokenAddress,
		address payable _to,
		uint256 _amountToRescue,
		uint32 _nonce
	) external;

	/**
        @notice Sets the handler responsible with relaying rescue transactions.
        @param _newHandler Address of the handler.
        @param _nonce Nonce of the update.
     */
	function setHandler(address _newHandler, uint32 _nonce) external;
}
