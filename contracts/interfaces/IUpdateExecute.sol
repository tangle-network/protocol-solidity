/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */
 
pragma solidity ^0.8.0;

/**
    @title Interface for handler contracts that support Anchor updates.
    @author ChainSafe Systems.
 */
interface IUpdateExecute {
    /**
        @notice It is intended that deposit are made using the Bridge contract.
        @param destinationChainID Chain ID deposit is expected to be bridged to.
        @param depositNonce This value is generated as an ID by the Bridge contract.
        @param updater The account triggering the update.
        @param data Consists of additional data needed for a specific update like height and root data
     */
    function update(bytes32 resourceID, uint8 destinationChainID, uint64 depositNonce, address updater, bytes calldata data) external;
}
