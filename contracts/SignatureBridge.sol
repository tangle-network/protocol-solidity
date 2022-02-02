/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./utils/AccessControl.sol";
import "./utils/Pausable.sol";
import "./utils/SafeMath.sol";
import "./utils/SafeCast.sol";
import "./utils/Governable.sol";
import "./utils/ChainIdWithType.sol";
import "./interfaces/IExecutor.sol";
import "hardhat/console.sol";

/**
    @title Facilitates deposits, creation and voting of deposit proposals, and deposit executions.
    @author ChainSafe Systems & Webb Technologies.
 */
contract SignatureBridge is Pausable, SafeMath, Governable, ChainIdWithType {
    // destinationChainID => number of deposits
    mapping(uint256 => uint64) public _counts;
    // resourceID => handler address
    mapping(bytes32 => address) public _resourceIDToHandlerAddress;

    /**
        Verifying signature of governor over some datahash
     */
    modifier signedByGovernor(bytes memory data, bytes memory sig) {
        require(isSignatureFromGovernor(data, sig), "signed by governor: Not valid sig from governor");
        _;
    }

    /**
        @notice Initializes SignatureBridge with a governor
        @param initialGovernor Addresses that should be initially granted the relayer role.
     */
    constructor (address initialGovernor) Governable(initialGovernor) {}

    /**
        @notice Sets a new resource for handler contracts that use the IExecutor interface,
        and maps the {handlerAddress} to {resourceID} in {_resourceIDToHandlerAddress}.
        @notice Only callable by an address that currently has the admin role.
        @param handlerAddress Address of handler resource will be set for.
        @param resourceID Secondary resourceID begin mapped to a handler address.
        @param executionContextAddress Address of contract to be called when a proposal is ready to execute on it
     */
    function adminSetResourceWithSignature(
        address handlerAddress,
        bytes32 resourceID,
        address executionContextAddress,
        bytes memory sig
    ) external signedByGovernor(
        abi.encodePacked(
            handlerAddress,
            resourceID,
            executionContextAddress
        ), sig
    ){
        _resourceIDToHandlerAddress[resourceID] = handlerAddress;
        IExecutor handler = IExecutor(handlerAddress);
        handler.setResource(resourceID, executionContextAddress);
    }

    /**
        @notice Executes a proposal signed by the governor.
        @param data Data meant for execution by execution handlers.
     */
    function executeProposalWithSignature(
        bytes calldata data,
        bytes memory sig
    ) external signedByGovernor(data, sig) {
        //Parse resourceID from the data
        bytes calldata resourceIDBytes = data[0:32];
        bytes32 resourceID = bytes32(resourceIDBytes);
        // Parse chain ID + chain type from the resource ID
        uint48 executionChainIdType = uint48(bytes6(resourceIDBytes[26:32]));
        // Verify current chain matches chain ID from resource ID
        require(uint256(getChainIdType()) == uint256(executionChainIdType), "executing on wrong chain");
        address handler = _resourceIDToHandlerAddress[resourceID];
        IExecutor executionHandler = IExecutor(handler);
        executionHandler.executeProposal(resourceID, data);
    }
}
