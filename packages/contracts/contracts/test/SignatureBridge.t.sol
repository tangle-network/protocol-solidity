/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity >=0.8.19 <0.9.0;

import { PRBTest } from "@prb/test/PRBTest.sol";
import { console2 } from "forge-std/console2.sol";
import { StdCheats } from "forge-std/StdCheats.sol";

import { ProposalHelpers } from "./ProposalHelpers.t.sol";
import { SignatureBridge } from "../SignatureBridge.sol";
import { AnchorHandler } from "../handlers/AnchorHandler.sol";

contract SignatureBridgeTest is ProposalHelpers, PRBTest, StdCheats {
	SignatureBridge bridge;
	AnchorHandler handler;
	address governor;

	uint16 constant CHAIN_TYPE = uint16(0x0100);
	uint32 CHAIN_ID;

	function setUp() public virtual {
		CHAIN_ID = uint32(getChainId());

		address alice = vm.addr(1);
		governor = alice;
		bridge = new SignatureBridge(governor, 0);

		bytes32[] memory initialResourceIds = new bytes32[](0);
		address[] memory initialContractAddresses = new address[](0);
		handler = new AnchorHandler(address(bridge), initialResourceIds, initialContractAddresses);
	}

	function test_governor() public {
		assertEq(address(bridge.governor()), vm.addr(1));
	}

	function test_setResource(address resource) public {
		bytes6 typedChainId = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID);
		bytes32 bridgeResourceId = this.buildResourceId(address(bridge), typedChainId);
		bytes32 newResourceId = this.buildResourceId(resource, typedChainId);
		uint32 nonce = 1;
		bytes memory setResourceProposal = this.buildSetResourceProposal(
			bridgeResourceId,
			nonce,
			newResourceId,
			address(handler)
		);
		bytes32 setResourceProposalHash = keccak256(setResourceProposal);
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, setResourceProposalHash);
		bytes memory sig = abi.encodePacked(r, s, v);
		bridge.adminSetResourceWithSignature(
			bridgeResourceId,
			SignatureBridge.adminSetResourceWithSignature.selector,
			nonce,
			newResourceId,
			address(handler),
			sig
		);
	}

	function test_setResourceShouldFailFromInvalidSignatureBytes(address resource) public {
		bytes6 typedChainId = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID);
		bytes32 bridgeResourceId = this.buildResourceId(address(bridge), typedChainId);
		bytes32 newResourceId = this.buildResourceId(resource, typedChainId);
		uint32 nonce = 1;
		bytes memory setResourceProposal = this.buildSetResourceProposal(
			bridgeResourceId,
			nonce,
			newResourceId,
			address(handler)
		);
		bytes32 setResourceProposalHash = keccak256(setResourceProposal);
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, "0xDEADBEEF");
		bytes memory sig = abi.encodePacked(r, s, v);
		vm.expectRevert(bytes("SignatureBridge: Not valid sig from governor"));
		bridge.adminSetResourceWithSignature(
			bridgeResourceId,
			SignatureBridge.adminSetResourceWithSignature.selector,
			nonce,
			newResourceId,
			address(handler),
			sig
		);
	}

	function test_setResourceShouldFailFromInvalidSigner(address resource) public {
		bytes6 typedChainId = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID);
		bytes32 bridgeResourceId = this.buildResourceId(address(bridge), typedChainId);
		bytes32 newResourceId = this.buildResourceId(resource, typedChainId);
		uint32 nonce = 1;
		bytes memory setResourceProposal = this.buildSetResourceProposal(
			bridgeResourceId,
			nonce,
			newResourceId,
			address(handler)
		);
		bytes32 setResourceProposalHash = keccak256(setResourceProposal);
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(2, setResourceProposalHash);
		bytes memory sig = abi.encodePacked(r, s, v);
		vm.expectRevert(bytes("SignatureBridge: Not valid sig from governor"));
		bridge.adminSetResourceWithSignature(
			bridgeResourceId,
			SignatureBridge.adminSetResourceWithSignature.selector,
			nonce,
			newResourceId,
			address(handler),
			sig
		);
	}

	function test_setResourceShouldFailFromInvalidNonce(address resource, uint32 nonce) public {
		vm.assume(nonce > 1);
		bytes6 typedChainId = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID);
		bytes32 bridgeResourceId = this.buildResourceId(address(bridge), typedChainId);
		bytes32 newResourceId = this.buildResourceId(resource, typedChainId);
		bytes memory setResourceProposal = this.buildSetResourceProposal(
			bridgeResourceId,
			nonce,
			newResourceId,
			address(handler)
		);
		bytes32 setResourceProposalHash = keccak256(setResourceProposal);
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, setResourceProposalHash);
		bytes memory sig = abi.encodePacked(r, s, v);
		vm.expectRevert(bytes("ProposalNonceTracker: Nonce must not increment more than 1"));
		bridge.adminSetResourceWithSignature(
			bridgeResourceId,
			SignatureBridge.adminSetResourceWithSignature.selector,
			nonce,
			newResourceId,
			address(handler),
			sig
		);
	}

	function test_setResourceShouldFailFromInvalidArgs(
		address resource,
		bytes4 functionSig
	) public {
		vm.assume(functionSig != SignatureBridge.adminSetResourceWithSignature.selector);
		bytes6 typedChainId = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID);
		bytes32 bridgeResourceId = this.buildResourceId(address(bridge), typedChainId);
		bytes32 newResourceId = this.buildResourceId(resource, typedChainId);
		uint32 nonce = 1;
		// Build the proposal with the wrong function signature
		bytes memory proposalHeader = buildProposalHeader(bridgeResourceId, functionSig, nonce);
		bytes memory proposalData = abi.encodePacked(newResourceId, address(handler));
		bytes memory proposal = buildProposal(proposalHeader, proposalData);
		bytes32 setResourceProposalHash = keccak256(proposal);
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, setResourceProposalHash);
		bytes memory sig = abi.encodePacked(r, s, v);
		vm.expectRevert(
			bytes("SignatureBridge::adminSetResourceWithSignature: Invalid function signature")
		);
		bridge.adminSetResourceWithSignature(
			bridgeResourceId,
			functionSig,
			nonce,
			newResourceId,
			address(handler),
			sig
		);
	}

	function test_setResourceShouldFailFromInvalidResourceIdContext(address resource) public {
		bytes6 typedChainId = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID);
		bytes32 invalidResourceId = this.buildResourceId(address(0x0), typedChainId);
		bytes32 newResourceId = this.buildResourceId(resource, typedChainId);
		uint32 nonce = 1;
		bytes memory setResourceProposal = this.buildSetResourceProposal(
			invalidResourceId,
			nonce,
			newResourceId,
			address(handler)
		);
		bytes32 setResourceProposalHash = keccak256(setResourceProposal);
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, setResourceProposalHash);
		bytes memory sig = abi.encodePacked(r, s, v);
		vm.expectRevert(
			bytes("SignatureBridge::adminSetResourceWithSignature: Invalid execution context")
		);
		bridge.adminSetResourceWithSignature(
			invalidResourceId,
			SignatureBridge.adminSetResourceWithSignature.selector,
			nonce,
			newResourceId,
			address(handler),
			sig
		);
	}

	function test_batchExecuteSetResourceProposals(address resource) public {
		bytes6 typedChainId = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID);
		bytes32 bridgeResourceId = this.buildResourceId(address(bridge), typedChainId);
		bytes[] memory proposals = new bytes[](10);
		uint32[] memory nonces = new uint32[](10);
		address[] memory handlers = new address[](10);
		bytes32[] memory newResourceIds = this.buildManyResourceIds(10, resource, typedChainId);

		for (uint i = 1; i <= 10; i++) {
			bytes memory proposal = this.buildSetResourceProposal(
				bridgeResourceId,
				uint32(i),
				newResourceIds[i - 1],
				address(handler)
			);
			proposals[i - 1] = proposal;
			nonces[i - 1] = uint32(i);
			handlers[i - 1] = address(handler);
		}
		bytes32 hashedData = keccak256(abi.encode(proposals));
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, hashedData);
		bytes memory sig = abi.encodePacked(r, s, v);
		bridge.batchAdminSetResourceWithSignature(
			bridgeResourceId,
			SignatureBridge.adminSetResourceWithSignature.selector,
			nonces,
			newResourceIds,
			handlers,
			hashedData,
			sig
		);
	}

	function test_batchExecuteShouldFailWithUnevenNonces(address resource) public {
		bytes6 typedChainId = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID);
		bytes32 bridgeResourceId = this.buildResourceId(address(bridge), typedChainId);
		bytes[] memory proposals = new bytes[](10);
		uint32[] memory nonces = new uint32[](10);
		address[] memory handlers = new address[](10);
		bytes32[] memory newResourceIds = this.buildManyResourceIds(10, resource, typedChainId);

		for (uint i = 1; i <= 10; i++) {
			bytes memory proposal = this.buildSetResourceProposal(
				bridgeResourceId,
				uint32(i),
				newResourceIds[i - 1],
				address(handler)
			);
			proposals[i - 1] = proposal;
			if (i == 2) {
				nonces[i - 1] = uint32(i - 1);
			} else {
				nonces[i - 1] = uint32(i);
			}

			handlers[i - 1] = address(handler);
		}
		bytes32 hashedData = keccak256(abi.encode(proposals));
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, hashedData);
		bytes memory sig = abi.encodePacked(r, s, v);
		vm.expectRevert(bytes("ProposalNonceTracker: Invalid nonce"));
		bridge.batchAdminSetResourceWithSignature(
			bridgeResourceId,
			SignatureBridge.adminSetResourceWithSignature.selector,
			nonces,
			newResourceIds,
			handlers,
			hashedData,
			sig
		);
	}

	function test_batchExecuteShouldFailWithIncorrectHash(address resource) public {
		bytes6 typedChainId = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID);
		bytes32 bridgeResourceId = this.buildResourceId(address(bridge), typedChainId);
		bytes[] memory proposals = new bytes[](10);
		uint32[] memory nonces = new uint32[](10);
		address[] memory handlers = new address[](10);
		bytes32[] memory newResourceIds = this.buildManyResourceIds(10, resource, typedChainId);

		for (uint i = 1; i <= 10; i++) {
			bytes memory proposal = this.buildSetResourceProposal(
				bridgeResourceId,
				uint32(i),
				newResourceIds[i - 1],
				address(handler)
			);
			proposals[i - 1] = proposal;
			nonces[i - 1] = uint32(i);
			handlers[i - 1] = address(handler);
		}
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, bytes32(0));
		bytes memory sig = abi.encodePacked(r, s, v);
		vm.expectRevert(
			bytes("SignatureBridge::batchAdminSetResourceWithSignature: Hashed data does not match")
		);
		bridge.batchAdminSetResourceWithSignature(
			bridgeResourceId,
			SignatureBridge.adminSetResourceWithSignature.selector,
			nonces,
			newResourceIds,
			handlers,
			bytes32(0),
			sig
		);
	}

	function test_isCorrectExecutionChain() public {
		bytes32 resourceId = this.buildResourceId(
			address(this),
			this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID)
		);
		assertEq(bridge.isCorrectExecutionChain(resourceId), true);
	}

	function test_isNotCorrectExecutionChain() public {
		bytes32 resourceId = this.buildResourceId(
			address(this),
			this.buildTypedChainId(0x0200, CHAIN_ID)
		);
		assertEq(bridge.isCorrectExecutionChain(resourceId), false);
	}

	function test_isCorrectExecutionContext() public {
		bytes32 resourceId = this.buildResourceId(
			address(address(bridge)),
			this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID)
		);
		assertEq(bridge.isCorrectExecutionContext(resourceId), true);
	}

	function test_isNotCorrectExecutionContext() public {
		bytes32 resourceId = this.buildResourceId(
			address(0x0),
			this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID)
		);
		assertEq(bridge.isCorrectExecutionContext(resourceId), false);
	}
}
