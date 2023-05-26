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
		Verifying signature of governor over some data
	 */
	modifier signedByGovernor(bytes memory data, bytes memory sig) {
		require(isSignatureFromGovernor(data, sig), "SignatureBridge: Not valid sig from governor");
		_;
	}

	/**
		Verifying signature of governor over some datahash
	 */
	modifier signedByGovernorPrehashed(bytes32 hashedData, bytes memory sig) {
		require(
			isSignatureFromGovernorPrehashed(hashedData, sig),
			"SignatureBridge: Not valid sig from governor"
		);
		_;
	}

	/**
		Verifying many signatures from a governor over some datahash
	 */
	modifier manySignedByGovernor(bytes[] memory data, bytes[] memory sig) {
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
		_handleSetResource(resourceID, functionSig, nonce, newResourceID, handlerAddress);
	}

	/**
		@notice Sets a batch new resources for handler contracts that use the IExecutor interface,
		and maps the {handlerAddress} to {newResourceID} in {_resourceIdToHandlerAddress}.
		@notice Only callable by an address that currently has the admin role.
		@param resourceID Target resource ID of the proposal header.
		@param functionSig Function signature of the proposal header.
		@param nonces Nonces of the proposal headers.
		@param newResourceIDs Secondary resourceIDs begin mapped to a handler address.
		@param handlerAddresses Addresses of handler resource will be set for.
		@param hashedData The encoded data of all proposals to be used for easy checking.
		@param sig The signature from the governor of the encoded set resource proposal.
	 */
	function batchAdminSetResourceWithSignature(
		bytes32 resourceID,
		bytes4 functionSig,
		uint32[] memory nonces,
		bytes32[] memory newResourceIDs,
		address[] memory handlerAddresses,
		bytes32 hashedData,
		bytes memory sig
	) external manyIncrementingByOne(nonces) signedByGovernorPrehashed(hashedData, sig) {
		require(
			nonces.length == newResourceIDs.length &&
				newResourceIDs.length == handlerAddresses.length,
			"SignatureBridge::batchAdminSetResourceWithSignature: Array lengths must match"
		);

		// Encode the proposals into a concatenated blob and hash to verify against the provided hash.
		bytes[] memory encodedData = new bytes[](nonces.length);
		for (uint256 i = 0; i < nonces.length; i++) {
			encodedData[i] = abi.encodePacked(
				resourceID,
				functionSig,
				nonces[i],
				newResourceIDs[i],
				handlerAddresses[i]
			);
		}
		require(
			keccak256(abi.encode(encodedData)) == hashedData,
			"SignatureBridge::batchAdminSetResourceWithSignature: Hashed data does not match"
		);

		for (uint i = 0; i < nonces.length; i++) {
			_handleSetResource(
				resourceID,
				functionSig,
				nonces[i],
				newResourceIDs[i],
				handlerAddresses[i]
			);
		}
	}

	/**
		@notice Executes a proposal signed by the governor.
		@param data Data meant for execution by execution handlers.
	 */
	function executeProposalWithSignature(
		bytes calldata data,
		bytes memory sig
	) external signedByGovernor(data, sig) {
		_handleExecuteProposal(data);
	}

	/**
		@notice Executes a many of proposals signed by the governor in a single tx.
		@param data Data meant for execution by execution handlers.
	 */
	function executeManyProposalsWithSignature(
		bytes[] calldata data,
		bytes[] memory sig
	) external manySignedByGovernor(data, sig) {
		for (uint256 i = 0; i < data.length; i++) {
			_handleExecuteProposal(data[i]);
		}
	}

	/**
		@notice Executes a batch of proposals signed by the governor in a single tx.
		@param data Data meant for execution by execution handlers.
	 */
	function batchExecuteProposalsWithSignature(
		bytes[] calldata data,
		bytes memory sig
	) external signedByGovernor(abi.encode(data), sig) {
		for (uint256 i = 0; i < data.length; i++) {
			_handleExecuteProposal(data[i]);
		}
	}

	function _handleExecuteProposal(bytes calldata data) internal {
		// Parse resourceID from the data
		bytes32 resourceID = bytes32(data[0:32]);
		require(
			this.isCorrectExecutionChain(resourceID),
			"SignatureBridge: Batch Executing on wrong chain"
		);
		address handler = _resourceIdToHandlerAddress[resourceID];
		IExecutor executionHandler = IExecutor(handler);
		executionHandler.executeProposal(resourceID, data);
	}

	function _handleSetResource(
		bytes32 resourceID,
		bytes4 functionSig,
		uint32 nonce,
		bytes32 newResourceID,
		address handlerAddress
	) internal {
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
}
