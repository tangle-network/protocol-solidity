/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
	@title ILinkableAnchor Interface
	@notice The interface supports updating edges for a graph-like functionality.
	It also supports setting handlers and verifiers for handling updates
	to the edge data of a LinkableAnchor as well as the verifier used in
	verifying proofs of knowledge of leaves in one-of-many merkle trees.

	The ILinkableAnchor interface can also be used with the VAnchor system
	to control the minimal and maximum withdrawal and deposit limits respectively.
 */
interface ILinkableAnchor {
	/**
		@notice Sets the handler for updating edges and other contract state
		@param _handler The new handler address
		@param _nonce The nonce for tracking update counts
	 */
	function setHandler(address _handler, uint32 _nonce) external;

	/**
		@notice Sets the verifier for zkSNARKs
		@param _verifier The new verifier address
		@param _nonce The nonce for tracking update counts
	 */	
	function setVerifier(address _verifier, uint32 _nonce) external;

	/**
		@notice Sets the minimal withdrawal limit for the anchor
		@param _minimalWithdrawalAmount The new minimal withdrawal limit
	 */
	function configureMinimalWithdrawalLimit(uint256 _minimalWithdrawalAmount) external;

	/**
		@notice Sets the maximal deposit limit for the anchor
		@param _maximumDepositAmount The new maximal deposit limit
	 */
	function configureMaximumDepositLimit(uint256 _maximumDepositAmount) external;
	
	/**
		@notice The function is used to update the edge data of a LinkableAnchor
		@param sourceChainID The chain ID of the chain whose edge needs updating
		@param root The merkle root of the linked anchor on the  `sourceChainID`'s chain
		@param latestLeafIndex The index of the leaf updating the merkle tree with root `root`
	 */
	function updateEdge(
		uint256 sourceChainID,
		bytes32 root,
		uint256 latestLeafIndex
	) external payable;
}