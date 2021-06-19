/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */
 
pragma solidity ^0.8.0;

/**
    @title Interface for handler contracts that support Anchor updates.
    @author ChainSafe Systems.
 */
interface IAnchorHandler {
    /**
        @notice It is intended that Anchor updates are made using the Bridge contract.
        @param resourceID The ID that identifies the target Anchor to be updated.
        @param updatedRoot The new merkle root of the target Anchor to update by resourceID.
        @param updatedRootHeight The height the new merkle root was updated on the target Anchor.
     */
    function update(bytes32 resourceID, bytes32 updatedRoot, uint updatedRootHeight) external;
}
