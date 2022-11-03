/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./HandlerHelpers.sol";
import "../interfaces/IExecutor.sol";
import "../interfaces/tokens/IMultiTokenManager.sol"; 

/**
    @title Handles MultiTokenManager token creation
    @author Webb Technologies.
    @notice This contract is intended to be used with the Bridge and SignatureBridge contracts.
 */
contract MultiTokenManagerHandler is IExecutor, HandlerHelpers {
    /**
        @param bridgeAddress Contract address of previously deployed Bridge.
        @param initialResourceIDs Resource IDs are used to identify a specific contract address.
        These are the Resource IDs this contract will initially support.
        @param initialContractAddresses These are the addresses the {initialResourceIDs} will point to, and are the contracts that will be
        called to perform various deposit calls.
        @dev {initialResourceIDs} and {initialContractAddresses} must have the same length (one resourceID for every address).
        Also, these arrays must be ordered in the way that {initialResourceIDs}[0] is the intended resourceID for {initialContractAddresses}[0].
     */
    constructor(
        address          bridgeAddress,
        bytes32[] memory initialResourceIDs,
        address[] memory initialContractAddresses
    ) {
        require(initialResourceIDs.length == initialContractAddresses.length,
            "initialResourceIDs and initialContractAddresses len mismatch");

        _bridgeAddress = bridgeAddress;

        for (uint256 i = 0; i < initialResourceIDs.length; i++) {
            _setResource(initialResourceIDs[i], initialContractAddresses[i]);
        }
    }

    /**
        @notice Proposal execution should be initiated when a proposal is finalized in the Bridge contract.
        by a relayer on the deposit's destination chain. Or when a valid signature is produced by the DKG in the case of SignatureBridge.
        @param resourceID ResourceID corresponding to a particular MultiTokenManager contract
        @param data Consists of a specific proposal data structure for each finer-grained token wrapper proposal
     */
    function executeProposal(bytes32 resourceID, bytes calldata data) external override onlyBridge {
        bytes32         resourceId;
        bytes4          functionSig;
        bytes  calldata arguments;
    
        resourceId = bytes32(data[0:32]);
        functionSig = bytes4(data[32:36]);
        arguments = data[36:];
    
        address multiTokenManagerAddress = _resourceIDToContractAddress[resourceID];
        IMultiTokenManager multiTokenManager = IMultiTokenManager(multiTokenManagerAddress); 
        
        if (functionSig == bytes4(keccak256("registerToken(bytes32,bytes32,bytes32,uint256,bool)"))) {  
            string memory nonce = bytes32ToString(bytes32(arguments[0:32])); 
            string memory newFee = bytes32ToString(bytes32(arguments[32:64]));
            bytes32 salt = bytes32(arguments[64:96]);
            uint256 fee = uint256(bytes32(arguments[96:128]));
            bool isNative = bytes1(arguments[128:129]) == 0x01;
            multiTokenManager.registerToken(nonce, newFee, salt, fee, isNative);
        } else {
            revert("Invalid function sig");
        }
    }

    function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
}
