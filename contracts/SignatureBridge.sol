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
    // destinationChainID => number of deposits
    mapping(uint256 => uint64) public _counts;
    // resourceID => handler address
    mapping(bytes32 => address) public _resourceIDToHandlerAddress;
    uint256 public proposalNonce = 0;
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
    constructor (address initialGovernor) Governable(initialGovernor) {}

    /**
        @notice Sets a new resource for handler contracts that use the IExecutor interface,
        and maps the {handlerAddress} to {resourceID} in {_resourceIDToHandlerAddress}.
        @notice Only callable by an address that currently has the admin role.
        @param handlerAddress Address of handler resource will be set for.
        @param resourceID Secondary resourceID begin mapped to a handler address.
        @param executionContextAddress Address of contract to be called when a proposal is ready to execute on it
     */
    function adminSetResource(
        address handlerAddress,
        bytes32 resourceID,
        address executionContextAddress,
        uint256 nonce
    ) override external onlyGovernor {
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce <= proposalNonce + 1, "Nonce must increment by 1");
        _resourceIDToHandlerAddress[resourceID] = handlerAddress;
        IExecutor handler = IExecutor(handlerAddress);
        handler.setResource(resourceID, executionContextAddress);
        proposalNonce = nonce;
    }

    function rescueTokens(address tokenAddress, address payable to, uint256 amountToRescue, uint256 nonce) override external onlyGovernor {
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
