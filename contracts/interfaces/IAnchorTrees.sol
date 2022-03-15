/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;


/**
	@title IAnchorTrees interface
	@notice Interface for AnchorTrees used in Anonymity mining
 */
interface IAnchorTrees {
	/**
		@notice Registers a deposit in the AnchorTree
		@param instance The address of the Anchor
		@param commitment The commitment to be inserted into the tree
	 */
	function registerDeposit(address instance, bytes32 commitment) external;

	/**
		@notice Registers a withdrawal in the AnchorTree
		@param instance The address of the Anchor
		@param nullifier The nullifier to be exposed during withdraw
	 */
	function registerWithdrawal(address instance, bytes32 nullifier) external;
}