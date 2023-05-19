/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;
pragma experimental ABIEncoderV2;

import "./HandlerHelpers.sol";
import "../interfaces/IExecutor.sol";
import "../interfaces/ITreasury.sol";

/**
    @title Handles Treasury rescue tokens proposal
    @author Webb Technologies.
    @notice This contract is intended to be used with the Bridge and SignatureBridge contracts.
 */
contract TreasuryHandler is IExecutor, HandlerHelpers {
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
		address bridgeAddress,
		bytes32[] memory initialResourceIDs,
		address[] memory initialContractAddresses
	) {
		require(
			initialResourceIDs.length == initialContractAddresses.length,
			"initialResourceIDs and initialContractAddresses len mismatch"
		);

		require(bridgeAddress != address(0), "Bridge Adress can't be 0");
		_bridgeAddress = bridgeAddress;

		for (uint256 i = 0; i < initialResourceIDs.length; i++) {
			_setResource(initialResourceIDs[i], initialContractAddresses[i]);
		}
	}

	/**
        @notice Proposal execution should be initiated when a proposal is finalized in the Bridge contract.
        by a relayer on the deposit's destination chain. Or when a valid signature is produced by the DKG in the case of SignatureBridge.
        @param resourceID ResourceID corresponding to a particular set of Treasury contracts
        @param data passed into the function should be constructed as follows:
        resourceID: bytes 0-32
        functionSig: bytes 32-36
        arguments: bytes 36-
        First 4 bytes of argument is nonce.  
     */
	function executeProposal(bytes32 resourceID, bytes calldata data) external override onlyBridge {
		bytes32 resourceId;
		bytes4 functionSig;
		bytes calldata arguments;

		resourceId = bytes32(data[0:32]);
		functionSig = bytes4(data[32:36]);
		arguments = data[36:];

		address treasuryAddress = _resourceIDToContractAddress[resourceID];
		ITreasury treasury = ITreasury(treasuryAddress);

		if (functionSig == bytes4(keccak256("setHandler(address,uint32)"))) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			address newHandler = address(bytes20(arguments[4:24]));
			treasury.setHandler(newHandler, nonce);
		} else if (
			functionSig == bytes4(keccak256("rescueTokens(address,address,uint256,uint32)"))
		) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			address tokenAddress = address(bytes20(arguments[4:24]));
			address payable to = payable(address(bytes20(arguments[24:44])));
			uint256 amountToRescue = uint256(bytes32(arguments[44:76]));
			treasury.rescueTokens(tokenAddress, to, amountToRescue, nonce);
		} else {
			revert("Invalid function sig");
		}
	}
}
