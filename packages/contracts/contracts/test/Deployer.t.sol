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
import { Treasury } from "../Treasury.sol";
import { TreasuryHandler } from "../handlers/TreasuryHandler.sol";
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
	Treasury treasury;
	TreasuryHandler treasuryHandler;

	address alice;
	address governor;
	bytes32 bridgeResourceId;
	bytes32 tokenResourceId;
	bytes32 vanchorResourceId;
	bytes32 treasuryResourceId;

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
		treasuryHandler = new TreasuryHandler(
			address(bridge),
			initialResourceIds,
			initialContractAddresses
		);
		treasury = new Treasury(address(treasuryHandler));
		hasher = new PoseidonHasher();
		token = new FungibleTokenWrapper("TOKEN", "TKN");
		uint16 feePercentage = 0;
		address feeRecipient = alice;
		uint256 limit = 100 ether;
		bool isNativeAllowed = true;
		address admin = alice;
		token.initialize(
			feePercentage,
			feeRecipient,
			address(tokenHandler),
			limit,
			isNativeAllowed,
			admin
		);

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
		treasuryResourceId = setResource(
			uint32(bridge.getProposalNonce() + 1),
			address(treasury),
			address(treasuryHandler)
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
		bytes32 targetResourceId,
		bytes32 merkleRoot,
		uint32 nonce,
		bytes32 srcResourceId
	) public {
		bytes memory anchorUpdateProposal = this.buildAnchorUpdateProposal(
			targetResourceId,
			merkleRoot,
			nonce,
			srcResourceId
		);
		bytes memory sig = this.signWithGoverner(anchorUpdateProposal);
		bridge.executeProposalWithSignature(anchorUpdateProposal, sig);
	}

	function executeSetMinimumWithdrawalLimitProposal(
		bytes32 targetResourceId,
		uint32 nonce,
		uint256 newMinimumWithdrawalLimit
	) public {
		bytes memory setMinimumWithdrawalLimitProposal = this
			.buildSetMinimumWithdrawalLimitProposal(
				targetResourceId,
				nonce,
				newMinimumWithdrawalLimit
			);
		bytes memory sig = this.signWithGoverner(setMinimumWithdrawalLimitProposal);
		bridge.executeProposalWithSignature(setMinimumWithdrawalLimitProposal, sig);
	}

	function executeSetMaximumDepositLimitProposal(
		bytes32 targetResourceId,
		uint32 nonce,
		uint256 newMaximumDepositLimit
	) public {
		bytes memory setMaximumDepositLimitProposal = this.buildSetMaximumDepositLimitProposal(
			targetResourceId,
			nonce,
			newMaximumDepositLimit
		);
		bytes memory sig = this.signWithGoverner(setMaximumDepositLimitProposal);
		bridge.executeProposalWithSignature(setMaximumDepositLimitProposal, sig);
	}

	function executeSetVerifierProposal(
		bytes32 targetResourceId,
		uint32 nonce,
		address newVerifier
	) public {
		bytes memory setVerifierProposal = this.buildSetVerifierProposal(
			targetResourceId,
			nonce,
			newVerifier
		);
		bytes memory sig = this.signWithGoverner(setVerifierProposal);
		bridge.executeProposalWithSignature(setVerifierProposal, sig);
	}

	function executeSetHandlerProposal(
		bytes32 targetResourceId,
		uint32 nonce,
		address newHandler
	) public {
		bytes memory setHandlerProposal = this.buildSetHandlerProposal(
			targetResourceId,
			nonce,
			newHandler
		);
		bytes memory sig = this.signWithGoverner(setHandlerProposal);
		bridge.executeProposalWithSignature(setHandlerProposal, sig);
	}

	function executeAddTokenProposal(
		bytes32 targetResourceId,
		uint32 nonce,
		address newToken
	) public {
		bytes memory addTokenProposal = this.buildAddTokenProposal(
			targetResourceId,
			nonce,
			newToken
		);
		bytes memory sig = this.signWithGoverner(addTokenProposal);
		bridge.executeProposalWithSignature(addTokenProposal, sig);
	}

	function executeRemoveTokenProposal(
		bytes32 targetResourceId,
		uint32 nonce,
		address tokenToRemove
	) public {
		bytes memory removeTokenProposal = this.buildRemoveTokenProposal(
			targetResourceId,
			nonce,
			tokenToRemove
		);
		bytes memory sig = this.signWithGoverner(removeTokenProposal);
		bridge.executeProposalWithSignature(removeTokenProposal, sig);
	}

	function executeSetFeeProposal(
		bytes32 targetResourceId,
		uint32 nonce,
		uint16 newFeePercentage
	) public {
		bytes memory setFeeProposal = this.buildSetFeeProposal(
			targetResourceId,
			nonce,
			newFeePercentage
		);
		bytes memory sig = this.signWithGoverner(setFeeProposal);
		bridge.executeProposalWithSignature(setFeeProposal, sig);
	}

	function executeSetFeeRecipientProposal(
		bytes32 targetResourceId,
		uint32 nonce,
		address newFeeRecipient
	) public {
		bytes memory setFeeRecipientProposal = this.buildSetFeeRecipientProposal(
			targetResourceId,
			nonce,
			newFeeRecipient
		);
		bytes memory sig = this.signWithGoverner(setFeeRecipientProposal);
		bridge.executeProposalWithSignature(setFeeRecipientProposal, sig);
	}

	function executeSetNativeAllowedProposal(
		bytes32 targetResourceId,
		uint32 nonce,
		bool isNativeAllowed
	) public {
		bytes memory setNativeAllowedProposal = this.buildSetNativeAllowedProposal(
			targetResourceId,
			nonce,
			isNativeAllowed
		);
		bytes memory sig = this.signWithGoverner(setNativeAllowedProposal);
		bridge.executeProposalWithSignature(setNativeAllowedProposal, sig);
	}

	function executeRescueTokensProposal(
		bytes32 targetResourceId,
		uint32 nonce,
		address tokenToRescue,
		address recipient,
		uint256 amount
	) public {
		bytes memory rescueTokensProposal = this.buildRescueTokensProposal(
			targetResourceId,
			nonce,
			tokenToRescue,
			payable(recipient),
			amount
		);

		bytes memory sig = this.signWithGoverner(rescueTokensProposal);
		bridge.executeProposalWithSignature(rescueTokensProposal, sig);
	}
}
