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
import { TokenWrapperHandler } from "../handlers/TokenWrapperHandler.sol";
import { AnchorHandler } from "../handlers/AnchorHandler.sol";
import { FungibleTokenWrapper } from "../tokens/FungibleTokenWrapper.sol";
import { VAnchorTree } from "../vanchors/instances/VAnchorTree.sol";
import { VAnchorVerifier } from "../verifiers/VAnchorVerifier.sol";
import { PoseidonHasher } from "../hashers/PoseidonHasher.sol";
import { Verifier2_2 } from "../verifiers/vanchor_2/Verifier2_2.sol";
import { Verifier8_2 } from "../verifiers/vanchor_2/Verifier8_2.sol";
import { Verifier2_16 } from "../verifiers/vanchor_16/Verifier2_16.sol";
import { Verifier8_16 } from "../verifiers/vanchor_16/Verifier8_16.sol";
import { IVAnchorVerifier2_2, IVAnchorVerifier2_16, IVAnchorVerifier8_2, IVAnchorVerifier8_16 } from "../interfaces/verifiers/IVAnchorVerifier.sol";

contract Deployer is ProposalHelpers, PRBTest, StdCheats {
	SignatureBridge bridge;
	AnchorHandler anchorHandler;
	VAnchorVerifier verifier;
	VAnchorTree vanchor;
	PoseidonHasher hasher;
	FungibleTokenWrapper token;
	TokenWrapperHandler tokenHandler;

	address alice;
	address governor;
	bytes32 bridgeResourceId;
	bytes32 tokenResourceId;
	bytes32 vanchorResourceId;

	uint16 constant CHAIN_TYPE = uint16(0x0100);
	uint32 CHAIN_ID;
	bytes6 THIS_CHAIN_ID;
	uint8 maxEdges;

	function setUp() public virtual {
		CHAIN_ID = uint32(getChainId());
		THIS_CHAIN_ID = this.buildTypedChainId(CHAIN_TYPE, CHAIN_ID);

		alice = vm.addr(1);
		governor = alice;
		bridge = new SignatureBridge(governor, 0);
		bridgeResourceId = this.buildResourceId(address(bridge), THIS_CHAIN_ID);

		bytes32[] memory initialResourceIds = new bytes32[](0);
		address[] memory initialContractAddresses = new address[](0);
		anchorHandler = new AnchorHandler(
			address(bridge),
			initialResourceIds,
			initialContractAddresses
		);
		tokenHandler = new TokenWrapperHandler(
			address(bridge),
			initialResourceIds,
			initialContractAddresses
		);

		hasher = new PoseidonHasher();
		token = new FungibleTokenWrapper("TOKEN", "TKN");
		uint16 feePercentage = 0;
		address feeRecipient = alice;
		address handler = address(tokenHandler);
		uint256 limit = 100 ether;
		bool isNativeAllowed = true;
		address admin = alice;
		token.initialize(feePercentage, feeRecipient, handler, limit, isNativeAllowed, admin);

		verifier = new VAnchorVerifier(
			IVAnchorVerifier2_2(address(new Verifier2_2())),
			IVAnchorVerifier2_16(address(new Verifier2_16())),
			IVAnchorVerifier8_2(address(new Verifier8_2())),
			IVAnchorVerifier8_16(address(new Verifier8_16()))
		);

		maxEdges = 1;
		uint32 merkleTreeLevels = 30;
		vanchor = new VAnchorTree(
			verifier,
			merkleTreeLevels,
			hasher,
			address(anchorHandler),
			address(token),
			maxEdges
		);
		// Initialize the vanchor with a minWithdrawal of 0 and maxDeposit of 100 ether
		vanchor.initialize(0, 100 ether);

		tokenResourceId = setResource(
			uint32(bridge.getProposalNonce() + 1),
			address(token),
			address(tokenHandler)
		);
		vanchorResourceId = setResource(
			uint32(bridge.getProposalNonce() + 1),
			address(vanchor),
			address(anchorHandler)
		);
	}

	function signWithGoverner(bytes memory data) public view returns (bytes memory) {
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, keccak256(data));
		return abi.encodePacked(r, s, v);
	}

	function setResource(uint32 nonce, address resource, address handler) public returns (bytes32) {
		bytes32 newResourceId = this.buildResourceId(resource, THIS_CHAIN_ID);
		bytes memory setResourceProposal = this.buildSetResourceProposal(
			bridgeResourceId,
			nonce,
			newResourceId,
			address(handler)
		);
		bytes memory sig = this.signWithGoverner(setResourceProposal);
		bridge.adminSetResourceWithSignature(
			bridgeResourceId,
			SignatureBridge.adminSetResourceWithSignature.selector,
			nonce,
			newResourceId,
			address(handler),
			sig
		);

		return newResourceId;
	}

	function executeAnchorUpdateProposal(
		bytes32 srcResourceId,
		bytes32 merkleRoot,
		uint32 leafIndex
	) public {
		bytes memory anchorUpdateProposal = this.buildAnchorUpdateProposal(
			vanchorResourceId,
			merkleRoot,
			leafIndex,
			srcResourceId
		);
		bytes memory sig = this.signWithGoverner(anchorUpdateProposal);
		bridge.executeProposalWithSignature(anchorUpdateProposal, sig);
	}
}
