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
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
    @title Facilitates deposits, creation and voting of deposit proposals, and deposit executions.
    @author ChainSafe Systems & Webb Technologies.
 */
contract SignatureBridge is Pausable, SafeMath, Governable {
    // destinationChainID => number of deposits
    mapping(uint256 => uint64) public _counts;
    // resourceID => handler address
    mapping(bytes32 => address) public _resourceIDToHandlerAddress;

    // The proposal nonce for rescue tokens proposal
    uint256 rescueTokensNonce = 0;
    /**
        Verifying signature of governor over some datahash
     */
    modifier signedByGovernor(bytes32 dataHash, bytes memory sig) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        require(isSignatureFromGovernor(abi.encodePacked(prefix, dataHash), sig), "signed by governor: Not valid sig from governor");
        _;
    }

    /**
        @notice Initializes SignatureBridge with a governor
        @param initialGovernor Addresses that should be initially granted the relayer role.
     */
    constructor (address initialGovernor) Governable(initialGovernor) {
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
        @notice Executes a proposal signed by the governor.
        @param data Data meant for execution by execution handlers.
     */
    function executeProposalWithSignature(
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
        IExecutor executionHandler = IExecutor(handler);
        executionHandler.executeProposal(resourceID, data);
    }

    function getChainId() public view returns (uint) {
        uint chainId;
        assembly { chainId := chainid() }
        return chainId;
    }

    /** 
        @notice Rescues tokens that have been locked in the bridge contract from the wrapping fee
        @param data The proposal data
        @param sig Signature of the data 
     */
    function rescueTokens(
        bytes calldata data, 
        bytes memory sig
    ) external signedByGovernor(keccak256(data), sig) {
        uint32 nonce;
        address tokenAddress;
        address payable to;
        uint256 amountToRescue;

        bytes calldata resourceIDBytes = data[0:32];
        // Parse chain ID from the resource ID
        bytes4 executionChainID = bytes4(resourceIDBytes[28:32]);
        // Verify current chain matches chain ID from resource ID
        require(uint32(getChainId()) == uint32(executionChainID), "executing on wrong chain");

        nonce = uint32(bytes4(data[36:40]));
        tokenAddress = address(bytes20(data[40:60]));
        to = payable(address(bytes20(data[60:80])));
        amountToRescue = uint256(bytes32(data[80:112]));

        require(to != address(0), "Cannot send liquidity to zero address");
        require(tokenAddress != address(this), "Cannot rescue wrapped asset");
        require(rescueTokensNonce < nonce, "Invalid nonce");
        require(nonce <= rescueTokensNonce + 1, "Nonce must increment by 1");

        if (tokenAddress == address(0)) {
            // Native Ether 
            uint256 ethBalance = address(this).balance;
            if(ethBalance >= amountToRescue) {
                to.transfer(amountToRescue);
            } else {
                to.transfer(ethBalance);
            }
            
        } else {
            // ERC20 Token
            uint256 erc20Balance = IERC20(tokenAddress).balanceOf(address(this));
            if(erc20Balance >= amountToRescue) {
                IERC20(tokenAddress).transfer(to, amountToRescue);
            } else {
                IERC20(tokenAddress).transfer(to, erc20Balance);
            }  
        }

        rescueTokensNonce = nonce;
    }
}
