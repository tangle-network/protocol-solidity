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
import "./interfaces/ISignatureBridge.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

/**
    @title Facilitates deposits, creation and voting of deposit proposals, and deposit executions.
    @author ChainSafe Systems & Webb Technologies.
 */
contract SignatureBridge is Pausable, SafeMath, Governable, ChainIdWithType, ISignatureBridge {
    // resourceID => handler address
    mapping(bytes32 => address) public _resourceIDToHandlerAddress;
    uint256 public proposalNonce = 0;
    address public bridgeHandler;
    /**
        Verifying signature of governor over some datahash
     */
    modifier signedByGovernor(bytes32 dataHash, bytes memory sig) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        require(isSignatureFromGovernor(abi.encodePacked(prefix, dataHash), sig), "signed by governor: Not valid sig from governor");
        _;
    }

    modifier onlyBridgeHandler()  {
        require(msg.sender == bridgeHandler, 'sender is not the bridge handler');
        _;
    }

    /**
        @notice Initializes SignatureBridge with a governor
        @param initialGovernor Addresses that should be initially granted the relayer role.
     */
    constructor (address initialGovernor) Governable(initialGovernor) {}

    function setBridgeHandler(address newHandler, uint32 nonce) onlyBridgeHandler override external {
        require(newHandler != address(0), "Handler cannot be 0");
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce <= proposalNonce + 1, "Nonce must increment by 1");
        bridgeHandler = newHandler;
        proposalNonce = nonce;
    }

    /**
        @notice Sets a new resource for handler contracts that use the IExecutor interface,
        and maps the {handlerAddress} to {resourceID} in {_resourceIDToHandlerAddress}.
        @notice Only callable by an address that currently has the admin role.
        @param data is (resourceId, functionSig, nonce, newResourceId, handlerAddress, executionContextAddress)
        @param sig DKG signature
     */
    function adminSetResourceWithSignature(
        bytes calldata data,
        bytes memory sig
    ) external override signedByGovernor(keccak256(data), sig) {
        //Parse resourceID from the data
        bytes calldata resourceIDBytes = data[0:32];
        bytes32 resourceID = bytes32(resourceIDBytes);
        // Parse chain ID + chain type from the resource ID
        uint48 executionChainIdType = uint48(bytes6(resourceIDBytes[26:32]));
        // Verify current chain matches chain ID from resource ID
        require(uint256(getChainIdType()) == uint256(executionChainIdType), "executing on wrong chain");

        bytes4 functionSig = bytes4(data[32:36]);
        require(functionSig == bytes4(keccak256("adminSetResourceWithSignature(bytes,bytes)")), "functionSig is incorrect for setting the resource with signature");

        bytes calldata arguments = data[36:]; 
        uint32 nonce = uint32(bytes4(arguments[0:4]));
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce <= proposalNonce + 1, "Nonce must increment by 1");

        bytes32 newResourceID = bytes32(arguments[4:36]);
        address handlerAddress = address(bytes20(arguments[36:56]));
        address executionContextAddress = address(bytes20(arguments[56:76])); 

        _resourceIDToHandlerAddress[newResourceID] = handlerAddress;
        IExecutor handler = IExecutor(handlerAddress);
        handler.setResource(newResourceID, executionContextAddress);

        proposalNonce = nonce;
    }


    function rescueTokens(address tokenAddress, address payable to, uint256 amountToRescue, uint256 nonce) override external onlyBridgeHandler {
        require(to != address(0), "Cannot send liquidity to zero address");
        require(tokenAddress != address(this), "Cannot rescue wrapped asset");
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce <= proposalNonce + 1, "Nonce must increment by 1");

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
        proposalNonce = nonce;
    }

    /**
        @notice Executes a proposal signed by the governor.
        @param data Data meant for execution by execution handlers.
     */
    function executeProposalWithSignature(
        bytes calldata data,
        bytes memory sig
    ) override external signedByGovernor(keccak256(data), sig) {
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

    /**
        @notice Function that allows SignatureBridge contract to receive funds and act as a treasury
     */
    receive() external payable {}
}
