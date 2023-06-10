/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/// @title SanctionsList interface for Chainalysis Sanctions List
/// @author Chainalysis
/// @notice This contract is meant to be used to check if an address is sanctioned.
interface ISanctionsList {
	function isSanctioned(address addr) external view returns (bool);
}
