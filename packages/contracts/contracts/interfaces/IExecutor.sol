/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/**
    @title Interface for handler contracts that support proposal executions.
    @author Webb Technologies, adapted from ChainSafe Systems.
 */
interface IExecutor {
	/**
        @notice It is intended that proposals are executed by the Bridge contract.
        @param data Consists of additional data needed for a specific deposit execution.
     */
	function executeProposal(bytes32 resourceID, bytes calldata data) external;

	/**
        @notice Correlates {resourceID} with {contractAddress}.
        @param resourceID ResourceID to be used when making deposits.
        @param contractAddress Address of contract to be called when a deposit is made and a deposited is executed.
     */
	function setResource(bytes32 resourceID, address contractAddress) external;

	/**
        @notice Migrates the bridge to a new bridge address
        @param newBridge New bridge address
     */
	function migrateBridge(address newBridge) external;
}
