/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./utils/Pausable.sol";
import "./utils/Governable.sol";
import "./utils/ChainIdWithType.sol";
import "./interfaces/IExecutor.sol";

/**
    @title Facilitates proposals execution and resource ID additions/updates
    @author ChainSafe Systems & Webb Technologies.
 */
contract SignatureBridge is Pausable, Governable, ChainIdWithType {
    uint256 public proposalNonce = 0;

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
    constructor (address initialGovernor, uint32 nonce) Governable(initialGovernor, nonce) {}

    /**
        @notice Sets a new resource for handler contracts that use the IExecutor interface,
        and maps the {handlerAddress} to {newResourceID} in {_resourceIDToHandlerAddress}.
        @notice Only callable by an address that currently has the admin role.
        @param resourceID Target resource ID of the proposal header.
        @param functionSig Function signature of the proposal header.
        @param nonce Nonce of the proposal header.
        @param newResourceID Secondary resourceID begin mapped to a handler address.
        @param handlerAddress Address of handler resource will be set for.
        @param sig The signature from the governor of the encoded set resource proposal.
     */
    function adminSetResourceWithSignature(
        bytes32 resourceID,
        bytes4 functionSig,
        uint32 nonce,
        bytes32 newResourceID,
        address handlerAddress,
        bytes memory sig
    ) external signedByGovernor(
        abi.encodePacked(
            resourceID,
            functionSig,
            nonce,
            newResourceID,
            handlerAddress
        ), sig
    ){
        require(this.isCorrectExecutionChain(resourceID), "adminSetResourceWithSignature: Executing on wrong chain");
        require(this.isCorrectExecutionChain(newResourceID), "adminSetResourceWithSignature: Executing on wrong chain");
        require(this.isCorrectExecutionContext(resourceID), "adminSetResourceWithSignature: Invalid execution context");
        require(proposalNonce < nonce, "adminSetResourceWithSignature: Invalid nonce");
        require(nonce < proposalNonce + 1048, "adminSetResourceWithSignature: Nonce must not increment more than 1048");
        require(
            functionSig == bytes4(keccak256(
                "adminSetResourceWithSignature(bytes32,bytes4,uint32,bytes32,address,bytes)"
            )),
            "adminSetResourceWithSignature: Invalid function signature"
        );
        _resourceIDToHandlerAddress[newResourceID] = handlerAddress;
        IExecutor handler = IExecutor(handlerAddress);
        address executionContext = address(bytes20(newResourceID << (6 * 8)));
        handler.setResource(newResourceID, executionContext);
        proposalNonce = nonce;
    }

    /**
        @notice Executes a proposal signed by the governor.
        @param data Data meant for execution by execution handlers.
     */
    function executeProposalWithSignature(
        bytes calldata data,
        bytes memory sig
    ) external signedByGovernor(data, sig) {
        // Parse resourceID from the data
        bytes32 resourceID = bytes32(data[0:32]);
        require(this.isCorrectExecutionChain(resourceID), "executeProposalWithSignature: Executing on wrong chain");
        address handler = _resourceIDToHandlerAddress[resourceID];
        IExecutor executionHandler = IExecutor(handler);
        executionHandler.executeProposal(resourceID, data);
    }

    function isCorrectExecutionChain(bytes32 resourceID) external view returns (bool) {
        uint64 executionChainId = parseChainIdFromResourceId(resourceID);
        // Verify current chain matches chain ID from resource ID
        return uint256(getChainIdType()) == uint256(executionChainId);
    }

    function isCorrectExecutionContext(bytes32 resourceId) public view returns (bool) {
        return address(bytes20(resourceId << (6 * 8))) == address(this);
    }
}
