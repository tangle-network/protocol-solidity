/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity >=0.8.19 <0.9.0;

import { console2 } from "forge-std/console2.sol";
import { StdCheats } from "forge-std/StdCheats.sol";

import { VAnchorTree } from "../vanchors/instances/VAnchorTree.sol";
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
		this.executeAnchorUpdateProposal(vanchorResourceId, merkleRoot, 1, srcResourceId);
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
		this.executeAnchorUpdateProposal(vanchorResourceId, merkleRoot, 1, srcResourceId);
		vm.expectRevert(bytes("LinkableAnchor: New leaf index must be greater"));
		this.executeAnchorUpdateProposal(vanchorResourceId, merkleRoot, 1, srcResourceId);
	}

	function test_anchorUpdatesShouldFailAfterLimit(
		address srcVAnchorBeingLinked,
		bytes32 merkleRoot
	) public {
		for (uint32 i = 0; i < maxEdges; i++) {
			bytes6 OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + i + 1);
			bytes32 srcResourceId = this.buildResourceId(srcVAnchorBeingLinked, OTHER_CHAIN_ID);
			this.executeAnchorUpdateProposal(vanchorResourceId, merkleRoot, 1, srcResourceId);
		}

		bytes6 NEW_OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + maxEdges + 1);
		bytes32 newSrcResourceId = this.buildResourceId(srcVAnchorBeingLinked, NEW_OTHER_CHAIN_ID);
		vm.expectRevert(bytes("LinkableAnchor: This Anchor is at capacity"));
		this.executeAnchorUpdateProposal(vanchorResourceId, merkleRoot, 1, newSrcResourceId);
	}

	function test_anchorUpdateShouldFailIfOverwritingEdgeIncorrectly(
		address srcVAnchorBeingLinked,
		bytes32 merkleRoot
	) public {
		bytes6 OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + 1);
		bytes32 srcResourceId = this.buildResourceId(srcVAnchorBeingLinked, OTHER_CHAIN_ID);
		this.executeAnchorUpdateProposal(vanchorResourceId, merkleRoot, 1, srcResourceId);
		// Try and update with the lower leaf index
		vm.expectRevert(bytes("LinkableAnchor: New leaf index must be greater"));
		this.executeAnchorUpdateProposal(vanchorResourceId, merkleRoot, 0, srcResourceId);
		// Try and update more than 2**16 leaf insertions
		vm.expectRevert(bytes("LinkableAnchor: New leaf index must be within 2^16 updates"));
		this.executeAnchorUpdateProposal(vanchorResourceId, merkleRoot, 2 ** 17, srcResourceId);
		// Try and update the srcResourceId for the same chain Id
		address newAddress = address(uint160(srcVAnchorBeingLinked) + 1);
		bytes32 invalidNewResourceId = this.buildResourceId(newAddress, OTHER_CHAIN_ID);
		vm.expectRevert(bytes("LinkableAnchor: srcResourceID must be the same"));
		this.executeAnchorUpdateProposal(vanchorResourceId, merkleRoot, 2, invalidNewResourceId);
	}

	function test_batchExecuteAnchorUpdateProposals(
		address[2] memory srcVAnchorsBeingLinked,
		bytes32[2] memory merkleRoots
	) public {
		maxEdges = 2;
		uint32 merkleTreeLevels = 30;
		VAnchorTree testVAnchor = new VAnchorTree(
			verifier,
			merkleTreeLevels,
			hasher,
			address(anchorHandler),
			address(token),
			maxEdges
		);
		// Initialize the vanchor with a minWithdrawal of 0 and maxDeposit of 100 ether
		testVAnchor.initialize(0, 100 ether);

		bytes32 testVanchorResourceId = setResource(
			uint32(bridge.proposalNonce() + 1),
			address(testVAnchor),
			address(anchorHandler)
		);

		vm.assume(srcVAnchorsBeingLinked[0] != srcVAnchorsBeingLinked[1]);
		bytes[] memory proposals = new bytes[](2);
		for (uint i = 1; i <= 2; i++) {
			bytes6 OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + uint32(i));
			bytes32 srcResourceId = this.buildResourceId(
				srcVAnchorsBeingLinked[i - 1],
				OTHER_CHAIN_ID
			);
			bytes memory proposal = this.buildAnchorUpdateProposal(
				testVanchorResourceId,
				merkleRoots[i - 1],
				1,
				srcResourceId
			);
			proposals[i - 1] = proposal;
		}
		bytes32 hashedData = keccak256(abi.encode(proposals));
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, hashedData);
		bytes memory sig = abi.encodePacked(r, s, v);
		bridge.batchExecuteProposalsWithSignature(proposals, sig);
	}

	function test_batchExecuteAnchorUpdateProposalsFromSameSrc(
		address srcVAnchorsBeingLinked,
		bytes32[10] memory merkleRoots
	) public {
		bytes6 OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + 1);
		bytes32 srcResourceId = this.buildResourceId(srcVAnchorsBeingLinked, OTHER_CHAIN_ID);
		bytes[] memory proposals = new bytes[](10);
		for (uint i = 1; i <= 10; i++) {
			bytes memory proposal = this.buildAnchorUpdateProposal(
				vanchorResourceId,
				merkleRoots[i - 1],
				uint32(i),
				srcResourceId
			);
			proposals[i - 1] = proposal;
		}
		bytes32 hashedData = keccak256(abi.encode(proposals));
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, hashedData);
		bytes memory sig = abi.encodePacked(r, s, v);
		bridge.batchExecuteProposalsWithSignature(proposals, sig);
	}

	function test_batchExecuteAnchorUpdateProposalsShouldFailWithInvalidLeafNonces(
		address srcVAnchorsBeingLinked,
		bytes32[2] memory merkleRoots
	) public {
		bytes6 OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + 1);
		bytes32 srcResourceId = this.buildResourceId(srcVAnchorsBeingLinked, OTHER_CHAIN_ID);
		bytes[] memory proposals = new bytes[](2);
		for (uint i = 1; i <= 2; i++) {
			bytes memory proposal = this.buildAnchorUpdateProposal(
				vanchorResourceId,
				merkleRoots[i - 1],
				1,
				srcResourceId
			);
			proposals[i - 1] = proposal;
		}
		bytes32 hashedData = keccak256(abi.encode(proposals));
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, hashedData);
		bytes memory sig = abi.encodePacked(r, s, v);
		vm.expectRevert(bytes("LinkableAnchor: New leaf index must be greater"));
		bridge.batchExecuteProposalsWithSignature(proposals, sig);
	}

	function test_batchExecuteAnchorUpdateProposalsShouldFailWithInvalidExecutionContexts(
		address srcVAnchorsBeingLinked,
		bytes32[2] memory merkleRoots
	) public {
		bytes6 OTHER_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID + 1);
		bytes32 srcResourceId = this.buildResourceId(srcVAnchorsBeingLinked, OTHER_CHAIN_ID);
		bytes[] memory proposals = new bytes[](10);
		for (uint i = 1; i <= 2; i++) {
			bytes32 tempResourceId;
			if (i == 1) {
				tempResourceId = vanchorResourceId;
			} else {
				tempResourceId = srcResourceId;
			}

			bytes memory proposal = this.buildAnchorUpdateProposal(
				tempResourceId,
				merkleRoots[i - 1],
				uint32(i),
				srcResourceId
			);
			proposals[i - 1] = proposal;
		}
		bytes32 hashedData = keccak256(abi.encode(proposals));
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, hashedData);
		bytes memory sig = abi.encodePacked(r, s, v);
		vm.expectRevert(bytes("SignatureBridge: Batch Executing on wrong chain"));
		bridge.batchExecuteProposalsWithSignature(proposals, sig);
	}

	function test_setMaximumDepositLimitProposal(uint256 newMaxDeposit) public {
		vm.assume(newMaxDeposit != vanchor.maximumDepositAmount());
		this.executeSetMaximumDepositLimitProposal(
			vanchorResourceId,
			uint32(vanchor.proposalNonce()) + 1,
			newMaxDeposit
		);
		assertEq(vanchor.maximumDepositAmount(), newMaxDeposit);
	}

	function test_setMinimumWithdrawalLimitProposal(uint256 newMinWithdrawal) public {
		vm.assume(newMinWithdrawal != vanchor.minimumWithdrawalAmount());
		this.executeSetMinimumWithdrawalLimitProposal(
			vanchorResourceId,
			uint32(vanchor.proposalNonce()) + 1,
			newMinWithdrawal
		);
		assertEq(vanchor.minimumWithdrawalAmount(), newMinWithdrawal);
	}

	function test_allCallsShouldFailWithInvalidNonce(address newHandler) public {
		vm.assume(newHandler != address(anchorHandler));
		vm.assume(newHandler != address(0));
		// With non-incremented nonce
		uint32 nonce = vanchor.proposalNonce();
		vm.expectRevert(bytes("ProposalNonceTracker: Nonce must not increment by 1"));
		this.executeSetMaximumDepositLimitProposal(vanchorResourceId, nonce, 100 ether);
		vm.expectRevert(bytes("ProposalNonceTracker: Nonce must not increment by 1"));
		this.executeSetMinimumWithdrawalLimitProposal(vanchorResourceId, nonce, 0);
		vm.expectRevert(bytes("ProposalNonceTracker: Nonce must not increment by 1"));
		this.executeSetHandlerProposal(vanchorResourceId, nonce, newHandler);
		// With incremented too much nonce
		nonce = vanchor.proposalNonce() + 2;
		vm.expectRevert("ProposalNonceTracker: Nonce must not increment more than 1");
		this.executeSetMaximumDepositLimitProposal(vanchorResourceId, nonce, 100 ether);
		vm.expectRevert("ProposalNonceTracker: Nonce must not increment more than 1");
		this.executeSetMinimumWithdrawalLimitProposal(vanchorResourceId, nonce, 0);
		vm.expectRevert("ProposalNonceTracker: Nonce must not increment more than 1");
		this.executeSetHandlerProposal(vanchorResourceId, nonce, newHandler);
	}

	function test_setHandlerProposal(address newHandler) public {
		vm.assume(newHandler != address(anchorHandler));
		vm.assume(newHandler != address(0));
		this.executeSetHandlerProposal(
			vanchorResourceId,
			uint32(vanchor.proposalNonce()) + 1,
			newHandler
		);
		assertEq(vanchor.handler(), newHandler);
	}
}
