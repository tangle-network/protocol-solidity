/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/// @title Lending pool deposit/withdraw functionality for Aave
/// @author Webb Technologies.
/// @notice This contract is meant to be used with the `TokenWrapper.sol`.
interface IAaveLendingPool {
	function deposit(
		address asset,
		uint256 amount,
		address onBehalfOf,
		uint16 referralCode
	) external;

	function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}
