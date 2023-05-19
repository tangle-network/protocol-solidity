/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;
pragma experimental ABIEncoderV2;

import "./HandlerHelpers.sol";
import "../interfaces/IExecutor.sol";
import "../interfaces/tokens/IFungibleTokenWrapper.sol";

/**
    @title Handles FungibleTokenWrapper fee and token updates
    @author Webb Technologies.
    @notice This contract is intended to be used with the Bridge and SignatureBridge contracts.
 */
contract TokenWrapperHandler is IExecutor, HandlerHelpers {
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

		require(bridgeAddress != address(0), "Bridge address can't be 0");
		_bridgeAddress = bridgeAddress;

		for (uint256 i = 0; i < initialResourceIDs.length; i++) {
			_setResource(initialResourceIDs[i], initialContractAddresses[i]);
		}
	}

	/**
        @notice Proposal execution should be initiated when a proposal is finalized in the Bridge contract.
        by a relayer on the deposit's destination chain. Or when a valid signature is produced by the DKG in the case of SignatureBridge.
        @param resourceID ResourceID corresponding to a particular set of FungibleTokenWrapper contracts
        @param data Consists of a specific proposal data structure for each finer-grained token wrapper proposal
     */
	function executeProposal(bytes32 resourceID, bytes calldata data) external override onlyBridge {
		bytes32 resourceId;
		bytes4 functionSig;
		bytes calldata arguments;

		resourceId = bytes32(data[0:32]);
		functionSig = bytes4(data[32:36]);
		arguments = data[36:];

		address fungibleTokenAddress = _resourceIDToContractAddress[resourceID];
		IFungibleTokenWrapper fungibleToken = IFungibleTokenWrapper(fungibleTokenAddress);

		if (functionSig == bytes4(keccak256("setFee(uint16,uint32)"))) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			uint16 newFee = uint16(bytes2(arguments[4:6]));
			fungibleToken.setFee(newFee, nonce);
		} else if (functionSig == bytes4(keccak256("add(address,uint32)"))) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			address tokenAddress = address(bytes20(arguments[4:24]));
			fungibleToken.add(tokenAddress, nonce);
		} else if (functionSig == bytes4(keccak256("remove(address,uint32)"))) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			address tokenAddress = address(bytes20(arguments[4:24]));
			fungibleToken.remove(tokenAddress, nonce);
		} else if (functionSig == bytes4(keccak256("setFeeRecipient(address,uint32)"))) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			address payable feeRecipient = payable(address(bytes20(arguments[4:24])));
			fungibleToken.setFeeRecipient(feeRecipient, nonce);
		} else {
			revert("Invalid function sig");
		}
	}
}
