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
import "./interfaces/IExecutor.sol";
import "./interfaces/IDepositExecute.sol";
import "./interfaces/IERCHandler.sol";
import "hardhat/console.sol";

/**
    @title Facilitates deposits, creation and voting of deposit proposals, and deposit executions.
    @author ChainSafe Systems & Webb Technologies.
 */
contract SignatureBridge is Pausable, SafeMath, Governable {
    using SafeCast for *;

    uint256 public _chainID;
    uint128 public _fee;
    uint40  public _expiry;

    enum ProposalStatus {Inactive, Active, Passed, Executed, Cancelled}

    // destinationChainID => number of deposits
    mapping(uint256 => uint64) public _counts;
    // resourceID => handler address
    mapping(bytes32 => address) public _resourceIDToHandlerAddress;

    event ProposalEvent(
        uint256  originChainID,
        ProposalStatus status,
        bytes32 dataHash,
        bytes sig
    );
    event ProposalVote(
        uint256  originChainID,
        uint64   nonce,
        ProposalStatus status,
        bytes32 dataHash
    );

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    /**
        Verifying signature of 
     */
    modifier signedByGovernor(bytes32 dataHash, bytes memory sig) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        require(isSignatureFromGovernor(abi.encodePacked(prefix, dataHash), sig), "signed by governor: Not valid sig from governor");
        _;
    }

    /**
        @notice Initializes Bridge, creates and grants {msg.sender} the admin role,
        creates and grants {initialGovernor} the relayer role.
        @param chainID ID of chain the Bridge contract exists on.
        @param initialGovernor Addresses that should be initially granted the relayer role.
     */
    constructor (uint256 chainID, address initialGovernor, uint256 fee, uint256 expiry) Governable(initialGovernor) {
        _chainID = chainID;
        _fee = fee.toUint128();
        _expiry = expiry.toUint40();
    }

    /**
        @notice Sets a new resource for handler contracts that use the IExecutor interface,
        and maps the {handlerAddress} to {resourceID} in {_resourceIDToHandlerAddress}.
        @notice Only callable by an address that currently has the admin role.
        @param handlerAddress Address of handler resource will be set for.
        @param resourceID ResourceID to be used when making deposits.
        @param executionContextAddress Address of contract to be called when a proposal is ready to execute on it
     */
    function adminSetResourceWithSignature(
      address handlerAddress,
      bytes32 resourceID,
      address executionContextAddress,
      bytes memory sig
    ) external signedByGovernor(keccak256(abi.encodePacked(handlerAddress, resourceID, executionContextAddress)), sig){
        _resourceIDToHandlerAddress[resourceID] = handlerAddress;
        IExecutor handler = IExecutor(handlerAddress);
        handler.setResource(resourceID, executionContextAddress);
    }

    /**
        @notice Migrates the handlers to a new bridge.
        @notice Expects the new bridge to have the same resourceID to handler mapping as the old bridge.
        @param resourceIDs ResourceID array to migrate all active handlers to the new bridge
        @param newBridge New bridge address to migrate handlers to.
     */
    function adminMigrateBridgeWithSignature(
      bytes32[] calldata resourceIDs,
      address newBridge,
      bytes memory sig
    ) external signedByGovernor(keccak256(abi.encodePacked(resourceIDs, newBridge)), sig) {
        for (uint i = 0; i < resourceIDs.length; i++) {
            IExecutor handler = IExecutor(_resourceIDToHandlerAddress[resourceIDs[i]]);
            handler.migrateBridge(newBridge);
        }
    }

    /**
        @notice Executes a deposit proposal that is considered passed using a specified handler contract.
        @notice Only callable by relayers when Bridge is not paused.
        @param chainID ID of chain deposit originated from.
        @param data Data originally provided when deposit was made.
        @notice Proposal must have Passed status.
        @notice Hash of {data} must equal proposal's {dataHash}.
        @notice Emits {ProposalEvent} event with status {Executed}.
     */
    function executeProposalWithSignature(
      uint256 chainID,
      bytes calldata data,
      bytes memory sig
    ) external signedByGovernor(keccak256(data), sig) {
        //Parse resourceID from the data
        bytes calldata resourceIDBytes = data[0:32];
        bytes32 resourceID = bytes32(resourceIDBytes);
        // Parse chain ID from the resource ID
        bytes4 executionChainID = bytes4(resourceIDBytes[28:32]);
        // Verify current chain matches chain ID from resource ID
        require(uint32(getChainId()) == uint32(executionChainID), "executing on wrong chain");
        address handler = _resourceIDToHandlerAddress[resourceID];
        bytes32 dataHash = keccak256(abi.encodePacked(handler, data));
        IExecutor executionHandler = IExecutor(handler);
        executionHandler.executeProposal(resourceID, data);
        
        emit ProposalEvent(chainID, ProposalStatus.Executed, dataHash, sig);
    }

    function getChainId() public view returns (uint) {
        uint chainId;
        assembly { chainId := chainid() }
        return chainId;
    }
}