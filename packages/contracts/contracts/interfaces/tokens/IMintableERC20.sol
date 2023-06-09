/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/// @title Interface for a mintable ERC20 token contract.
/// @author Webb Technologies.
interface IMintableERC20 {
	/// @dev Mints `amount` tokens to account `to`.
	/// @notice Emits a {Transfer} event.
	function mint(address to, uint256 amount) external;

	/// @dev Moves `amount` tokens from the caller's account to `recipient`.
	/// @dev Returns a boolean value indicating whether the operation succeeded.
	/// @notice Emits a {Transfer} event.
	function transfer(address recipient, uint256 amount) external returns (bool);

	/// @dev Moves `amount` tokens from `sender` to `recipient` using theallowance mechanism. `amount` is then deducted from the caller'sallowance.
	/// @dev Returns a boolean value indicating whether the operation succeeded.
	/// @notice Emits a {Transfer} event.
	function transferFrom(
		address sender,
		address recipient,
		uint256 amount
	) external returns (bool);
}
