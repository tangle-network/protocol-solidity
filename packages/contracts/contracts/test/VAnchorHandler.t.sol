/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity >=0.8.19 <0.9.0;

import { console2 } from "forge-std/console2.sol";
import { StdCheats } from "forge-std/StdCheats.sol";

import { Deployer } from "./Deployer.t.sol";

contract VAnchorHandlerTest is Deployer {
	function setUp() public virtual override {
		super.setUp();
	}

	function test_deployVAnchorSystem() public {
		// Verify addresses set
		assertEq(address(anchorHandler._bridgeAddress()), address(bridge));
		assertEq(address(tokenHandler._bridgeAddress()), address(bridge));
		assertEq(address(vanchor.token()), address(token));
		assertEq(address(vanchor.handler()), address(anchorHandler));
		assertEq(address(token.handler()), address(tokenHandler));
		assertEq(address(vanchor.verifier()), address(verifier));
		assertEq(address(vanchor.hasher()), address(hasher));
		// Verify resource IDs set
		assertEq(anchorHandler._resourceIDToContractAddress(vanchorResourceId), address(vanchor));
		assertEq(anchorHandler._contractAddressToResourceID(address(vanchor)), vanchorResourceId);
		assertEq(tokenHandler._resourceIDToContractAddress(tokenResourceId), address(token));
		assertEq(tokenHandler._contractAddressToResourceID(address(token)), tokenResourceId);
		assertEq(bridge._resourceIdToHandlerAddress(vanchorResourceId), address(anchorHandler));
		assertEq(bridge._resourceIdToHandlerAddress(tokenResourceId), address(tokenHandler));
	}

	function test_anchorUpdateProposal(address srcVAnchorBeingLinked, bytes32 merkleRoot) public {
		// Same chain type, different chain ID, different `TypedChainId`
		bytes6 OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + 1);
		bytes32 srcResourceId = this.buildResourceId(srcVAnchorBeingLinked, OTHER_CHAIN_ID);
		this.executeAnchorUpdateProposal(srcResourceId, merkleRoot, 1);
		// Once executed, verify the state of the linked vanchor on the target vanchor
		uint256 srcTypedChainId = uint256(uint48(OTHER_CHAIN_ID));
		assertEq(vanchor.edgeExistsForChain(uint256(uint48(THIS_CHAIN_ID))), false);
		assertEq(vanchor.edgeExistsForChain(srcTypedChainId), true);
		assertEq(vanchor.edgeIndex(srcTypedChainId), 0);
		(uint256 chainId, uint256 root, uint256 leafIndex, bytes32 resourceId) = vanchor.edgeList(
			0
		);
		assertEq(chainId, srcTypedChainId);
		assertEq(root, uint256(merkleRoot));
		assertEq(leafIndex, 1);
		assertEq(resourceId, srcResourceId);
	}

	function test_anchorUpdateShouldFailWithSameProposal(
		address srcVAnchorBeingLinked,
		bytes32 merkleRoot
	) public {
		bytes6 OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + 1);
		assertEq(vanchor.edgeExistsForChain(uint256(uint48(OTHER_CHAIN_ID))), false);
		assertEq(vanchor.edgeExistsForChain(uint256(uint48(THIS_CHAIN_ID))), false);
		bytes32 srcResourceId = this.buildResourceId(srcVAnchorBeingLinked, OTHER_CHAIN_ID);
		this.executeAnchorUpdateProposal(srcResourceId, merkleRoot, 1);
		vm.expectRevert(bytes("LinkableAnchor: New leaf index must be greater"));
		this.executeAnchorUpdateProposal(srcResourceId, merkleRoot, 1);
	}

	function test_anchorUpdatesShouldFailAfterLimit(
		address srcVAnchorBeingLinked,
		bytes32 merkleRoot
	) public {
		for (uint32 i = 0; i < maxEdges; i++) {
			bytes6 OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + i + 1);
			bytes32 srcResourceId = this.buildResourceId(srcVAnchorBeingLinked, OTHER_CHAIN_ID);
			this.executeAnchorUpdateProposal(srcResourceId, merkleRoot, 1);
		}

		bytes6 OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + maxEdges + 1);
		bytes32 srcResourceId = this.buildResourceId(srcVAnchorBeingLinked, OTHER_CHAIN_ID);
		vm.expectRevert(bytes("LinkableAnchor: This Anchor is at capacity"));
		this.executeAnchorUpdateProposal(srcResourceId, merkleRoot, 1);
	}

	function test_anchorUpdateShouldFailIfOverwritingEdgeIncorrectly(
		address srcVAnchorBeingLinked,
		bytes32 merkleRoot
	) public {
		bytes6 OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + 1);
		bytes32 srcResourceId = this.buildResourceId(srcVAnchorBeingLinked, OTHER_CHAIN_ID);
		this.executeAnchorUpdateProposal(srcResourceId, merkleRoot, 1);
		// Try and update with the lower leaf index
		vm.expectRevert(bytes("LinkableAnchor: New leaf index must be greater"));
		this.executeAnchorUpdateProposal(srcResourceId, merkleRoot, 0);
		// Try and update more than 2**16 leaf insertions
		vm.expectRevert(bytes("LinkableAnchor: New leaf index must be within 2^16 updates"));
		this.executeAnchorUpdateProposal(srcResourceId, merkleRoot, 2 ** 17);
		// Try and update the srcResourceId for the same chain Id
		address newAddress = address(uint160(srcVAnchorBeingLinked) + 1);
		bytes32 invalidNewResourceId = this.buildResourceId(newAddress, OTHER_CHAIN_ID);
		vm.expectRevert(bytes("LinkableAnchor: srcResourceID must be the same"));
		this.executeAnchorUpdateProposal(invalidNewResourceId, merkleRoot, 2);
	}
}
