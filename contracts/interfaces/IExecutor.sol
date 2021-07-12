/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */
 
pragma solidity ^0.8.0;

/**
    @title Interface for handler contracts that support deposits and deposit executions.
    @author ChainSafe Systems.
 */
interface IExecutor {
    /**
        @notice It is intended that proposals are executed by the Bridge contract.
        @param data Consists of additional data needed for a specific deposit execution.
     */
    function executeProposal(bytes32 resourceID, bytes calldata data) external;
}
