/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/**
    @title Interface for Aave Token Wrapper contract.
    @author Webb Technologies.
 */
interface IAaveTokenWrapper {
	/**
        @notice Deposits token at `_tokenAddress` into Aave Lending Pool
        @param _tokenAddress The address of the token to deposit
        @param _amount The amount to deposit
     */
	function deposit(address _tokenAddress, uint256 _amount) external;

	/**
        @notice Withdraws token at `_tokenAddress` from Aave Lending Pool
        @param _tokenAddress The address of the token to withdraw
        @param _amount The amount to withdraw
     */
	function withdraw(address _tokenAddress, uint256 _amount) external;
}
