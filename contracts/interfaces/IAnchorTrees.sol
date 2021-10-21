/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

 pragma solidity ^0.8.0;

 interface IAnchorTrees {
	function registerDeposit(address instance, bytes32 commitment) external;

	function registerWithdrawal(address instance, bytes32 nullifier) external;
}