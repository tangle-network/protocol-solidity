/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
	@dev The Edge struct is used to store the edge data for linkable tree connections.
	@param chainId The chain id where the LinkableAnchor contract being linked is located.
	@param root The latest merkle root of the LinkableAnchor contract being linked.
	@param nonce The latest leaf insertion index of the LinkableAnchor contract being linked.
	@param srcResourceID The contract address or tree identifier of the LinkableAnchor being linked.
	*/
struct Edge {
	uint256 chainID;
	bytes32 root;
	uint256 latestLeafIndex;
	bytes32 srcResourceID;
}