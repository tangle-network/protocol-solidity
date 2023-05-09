/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;
pragma experimental ABIEncoderV2;

import "./HandlerHelpers.sol";
import "../interfaces/IExecutor.sol";
import "../interfaces/verifiers/ISetVerifier.sol";
import "../interfaces/ILinkableAnchor.sol";

/**
    @title Handles Anchor edge list merkle root updates
    @author Webb Technologies.
    @notice This contract is intended to be used with the Bridge contract.
 */
contract AnchorHandler is IExecutor, HandlerHelpers {
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
		require(bridgeAddress != address(0), "Bridge Address can't be 0");
		_bridgeAddress = bridgeAddress;

		for (uint256 i = 0; i < initialResourceIDs.length; i++) {
			_setResource(initialResourceIDs[i], initialContractAddresses[i]);
		}
	}

	/**
        @notice Proposal execution should be initiated when a proposal is signed and executed by the `SignatureBridge`
        @param resourceID ResourceID corresponding to a particular executing anchor contract.
        @param data Consists of a specific proposal data structure for each finer-grained anchor proposal
     */
	function executeProposal(bytes32 resourceID, bytes calldata data) external override onlyBridge {
		bytes32 resourceId;
		bytes4 functionSig;
		bytes calldata arguments;

		resourceId = bytes32(data[0:32]);
		functionSig = bytes4(data[32:36]);
		arguments = data[36:];

		address anchorAddress = _resourceIDToContractAddress[resourceID];

		require(_contractWhitelist[anchorAddress], "provided tokenAddress is not whitelisted");

		if (functionSig == bytes4(keccak256("setHandler(address,uint32)"))) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			address newHandler = address(bytes20(arguments[4:24]));
			ILinkableAnchor(anchorAddress).setHandler(newHandler, nonce);
		} else if (functionSig == bytes4(keccak256("setVerifier(address,uint32)"))) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			address newVerifier = address(bytes20(arguments[4:24]));
			ISetVerifier(anchorAddress).setVerifier(newVerifier, nonce);
		} else if (functionSig == bytes4(keccak256("updateEdge(uint256,uint32,bytes32)"))) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			uint256 merkleRoot = uint256(bytes32(arguments[4:36]));
			bytes32 target = bytes32(arguments[36:68]);
			ILinkableAnchor(anchorAddress).updateEdge(merkleRoot, nonce, target);
		} else if (
			functionSig == bytes4(keccak256("configureMinimalWithdrawalLimit(uint256,uint32)"))
		) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			uint256 minimalWithdrawalAmount = uint256(bytes32(arguments[4:36]));
			ILinkableAnchor(anchorAddress).configureMinimalWithdrawalLimit(
				minimalWithdrawalAmount,
				nonce
			);
		} else if (
			functionSig == bytes4(keccak256("configureMaximumDepositLimit(uint256,uint32)"))
		) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			uint256 maximumDepositAmount = uint256(bytes32(arguments[4:36]));
			ILinkableAnchor(anchorAddress).configureMaximumDepositLimit(
				maximumDepositAmount,
				nonce
			);
		} else {
			revert("Invalid function sig");
		}
	}
}
