/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/**
    @title Interface for Token Wrapper contract.
    @author Webb Technologies.
 */
interface IFungibleTokenWrapper {
	/**
        @notice Adds a token at `_tokenAddress` to the FungibleTokenWrapper's wrapping list
        @param _tokenAddress The address of the token to be added
        @param _nonce The nonce tracking updates to this contract
        @notice Only the governor can call this function
     */
	function add(address _tokenAddress, uint32 _nonce) external;

	/**
        @notice Removes a token at `_tokenAddress` from the FungibleTokenWrapper's wrapping list
        @param _tokenAddress The address of the token to be removed
        @param _nonce The nonce tracking updates to this contract
        @notice Only the governor can call this function
     */
	function remove(address _tokenAddress, uint32 _nonce) external;

	/**
        @notice Sets a new `_feePercentage` for the FungibleTokenWrapper
        @param _feePercentage The new fee percentage
        @param _nonce The nonce tracking updates to this contract
        @notice Only the governor can call this function
     */
	function setFee(uint16 _feePercentage, uint32 _nonce) external;

	/**
        @notice Sets a new `_feeRecipient` for the FungibleTokenWrapper
        @param _feeRecipient The new fee recipient
        @param _nonce The nonce tracking updates to this contract
        @notice Only the governor can call this function
     */
	function setFeeRecipient(address payable _feeRecipient, uint32 _nonce) external;
}
