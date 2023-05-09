/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;
pragma experimental ABIEncoderV2;

import "./utils/Governable.sol";
import "./utils/ChainIdWithType.sol";
import "./utils/ProposalNonceTracker.sol";
import "./interfaces/IExecutor.sol";

/**
    @title Facilitates proposals execution and resource ID additions/updates
    @author ChainSafe Systems & Webb Technologies.
 */
contract SignatureBridge is Governable, ChainIdWithType, ProposalNonceTracker {
	// resourceID => handler address
	mapping(bytes32 => address) public _resourceIdToHandlerAddress;

	/**
        Verifying signature of governor over some datahash
     */
	modifier signedByGovernor(bytes memory data, bytes memory sig) {
		require(isSignatureFromGovernor(data, sig), "SignatureBridge: Not valid sig from governor");
		_;
	}

	/**
        Verifying batch signatures from a governor over some datahash
     */
	modifier batchSignedByGovernor(bytes[] memory data, bytes[] memory sig) {
		require(data.length == sig.length, "SignatureBridge: Data and sig lengths must match");
		for (uint256 i = 0; i < data.length; i++) {
			require(
				isSignatureFromGovernor(data[i], sig[i]),
				"SignatureBridge: Not valid sig from governor"
			);
		}
		_;
	}

	/**
        @notice Initializes SignatureBridge with a governor
        @param initialGovernor Addresses that should be initially granted the relayer role.
     */
	constructor(address initialGovernor, uint32 nonce) Governable(initialGovernor, nonce) {}

	/**
        @notice Sets a new resource for handler contracts that use the IExecutor interface,
        and maps the {handlerAddress} to {newResourceID} in {_resourceIdToHandlerAddress}.
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
	)
		external
		onlyIncrementingByOne(nonce)
		signedByGovernor(
			abi.encodePacked(resourceID, functionSig, nonce, newResourceID, handlerAddress),
			sig
		)
	{
		require(
			this.isCorrectExecutionChain(resourceID),
			"SignatureBridge::adminSetResourceWithSignature: Executing on wrong chain"
		);
		require(
			this.isCorrectExecutionChain(newResourceID),
			"SignatureBridge::adminSetResourceWithSignature: Executing on wrong chain"
		);
		require(
			this.isCorrectExecutionContext(resourceID),
			"SignatureBridge::adminSetResourceWithSignature: Invalid execution context"
		);
		require(
			functionSig ==
				bytes4(
					keccak256(
						"adminSetResourceWithSignature(bytes32,bytes4,uint32,bytes32,address,bytes)"
					)
				),
			"SignatureBridge::adminSetResourceWithSignature: Invalid function signature"
		);
		_resourceIdToHandlerAddress[newResourceID] = handlerAddress;
		IExecutor handler = IExecutor(handlerAddress);
		address executionContext = address(bytes20(newResourceID << (6 * 8)));
		handler.setResource(newResourceID, executionContext);
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
		require(
			this.isCorrectExecutionChain(resourceID),
			"SignatureBridge: Executing on wrong chain"
		);
		address handler = _resourceIdToHandlerAddress[resourceID];
		IExecutor executionHandler = IExecutor(handler);
		executionHandler.executeProposal(resourceID, data);
	}

	/**
        @notice Executes a batch of proposals signed by the governor.
        @param data Data meant for execution by execution handlers.
     */
	function batchExecuteProposalWithSignature(
		bytes[] calldata data,
		bytes[] memory sig
	) external batchSignedByGovernor(data, sig) {
		for (uint256 i = 0; i < data.length; i++) {
			// Parse resourceID from the data
			bytes32 resourceID = bytes32(data[i][0:32]);
			require(
				this.isCorrectExecutionChain(resourceID),
				"SignatureBridge: Batch Executing on wrong chain"
			);
			address handler = _resourceIdToHandlerAddress[resourceID];
			IExecutor executionHandler = IExecutor(handler);
			executionHandler.executeProposal(resourceID, data[i]);
		}
	}
}
