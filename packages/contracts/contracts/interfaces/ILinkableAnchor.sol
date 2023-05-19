/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

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
        @param handler The new handler address
        @param nonce The nonce for tracking update counts
     */
	function setHandler(address handler, uint32 nonce) external;

	/**
        @notice Sets the minimal withdrawal limit for the anchor
        @param minimalWithdrawalAmount The new minimal withdrawal limit
     */
	function configureMinimalWithdrawalLimit(
		uint256 minimalWithdrawalAmount,
		uint32 nonce
	) external;

	/**
        @notice Sets the maximal deposit limit for the anchor
        @param maximumDepositAmount The new maximal deposit limit
     */
	function configureMaximumDepositLimit(uint256 maximumDepositAmount, uint32 nonce) external;

	/**
        @notice The function is used to update the edge data of a LinkableAnchor
        @param root The merkle root of the linked anchor on the  `sourceChainID`'s chain
        @param latestLeafIndex The index of the leaf updating the merkle tree with root `root`
        @param srcResourceID The source resource ID of the linked anchor where the update originates from
     */
	function updateEdge(
		uint256 root,
		uint32 latestLeafIndex,
		bytes32 srcResourceID
	) external payable;
}
