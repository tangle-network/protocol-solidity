/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity >=0.8.19 <0.9.0;

import { console2 } from "forge-std/console2.sol";
import { StdCheats } from "forge-std/StdCheats.sol";

import { Deployer } from "./Deployer.t.sol";

contract TokenWrapperHandlerTest is Deployer {
	function setUp() public virtual override {
		super.setUp();
	}

	function test_deployTokenWrapperHandler() public {
		assertEq(token.handler(), address(tokenHandler));
		assertEq(bridge._resourceIdToHandlerAddress(tokenResourceId), address(tokenHandler));
		assertEq(tokenHandler._bridgeAddress(), address(bridge));

		assertEq(tokenHandler._resourceIDToContractAddress(tokenResourceId), address(token));
		assertEq(tokenHandler._contractAddressToResourceID(address(token)), tokenResourceId);
	}

	function test_addTokenProposalShouldWork() public {
		uint256 proposalNonce = token.proposalNonce();
		address[] memory tokens = token.getTokens();
		assertEq(tokens.length, 0);
		this.executeAddTokenProposal(tokenResourceId, token.proposalNonce() + 1, address(token));
		assertEq(token.proposalNonce(), proposalNonce + 1);
		tokens = token.getTokens();
		assertEq(tokens.length, 1);
		assertEq(tokens[0], address(token));
	}

	function test_removeTokenProposalShouldWork() public {
		uint256 proposalNonce = token.proposalNonce();
		address[] memory tokens = token.getTokens();
		assertEq(tokens.length, 0);
		this.executeAddTokenProposal(tokenResourceId, token.proposalNonce() + 1, address(token));
		assertEq(token.proposalNonce(), proposalNonce + 1);
		tokens = token.getTokens();
		assertEq(tokens.length, 1);
		assertEq(tokens[0], address(token));
		this.executeRemoveTokenProposal(tokenResourceId, token.proposalNonce() + 1, address(token));
		assertEq(token.proposalNonce(), proposalNonce + 2);
		tokens = token.getTokens();
		assertEq(tokens.length, 0);
	}

	function test_setNativeAllowedShouldWork() public {
		assertEq(token.isNativeAllowed(), true);
		this.executeSetNativeAllowedProposal(tokenResourceId, token.proposalNonce() + 1, false);
		assertEq(token.isNativeAllowed(), false);
		// Flip it again
		this.executeSetNativeAllowedProposal(tokenResourceId, token.proposalNonce() + 1, true);
		assertEq(token.isNativeAllowed(), true);
	}

	function test_setFeeShouldWork() public {
		assertEq(token.feePercentage(), 0);
		this.executeSetFeeProposal(tokenResourceId, token.proposalNonce() + 1, 100);
		assertEq(token.feePercentage(), 100);
		// Flip it again
		this.executeSetFeeProposal(tokenResourceId, token.proposalNonce() + 1, 0);
		assertEq(token.feePercentage(), 0);
	}

	function test_setFeeRecipientShouldWork() public {
		assertEq(token.feeRecipient(), vm.addr(1));
		this.executeSetFeeRecipientProposal(tokenResourceId, token.proposalNonce() + 1, vm.addr(2));
		assertEq(token.feeRecipient(), vm.addr(2));
		// Flip it again
		this.executeSetFeeRecipientProposal(tokenResourceId, token.proposalNonce() + 1, vm.addr(3));
		assertEq(token.feeRecipient(), vm.addr(3));
	}

	function test_allCallsShouldFailWithInvalidNonce() public {
		// With non-incremented nonce
		uint32 nonce = token.proposalNonce();
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeAddTokenProposal(tokenResourceId, nonce, address(token));
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeRemoveTokenProposal(tokenResourceId, nonce, address(token));
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeSetNativeAllowedProposal(tokenResourceId, nonce, false);
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeSetFeeProposal(tokenResourceId, nonce, 100);
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeSetFeeRecipientProposal(tokenResourceId, nonce, vm.addr(2));
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeSetHandlerProposal(tokenResourceId, nonce, vm.addr(2));
		// With incremented too much nonce
		nonce = token.proposalNonce() + 2;
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeAddTokenProposal(tokenResourceId, nonce + 2, address(token));
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeRemoveTokenProposal(tokenResourceId, nonce + 2, address(token));
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeSetNativeAllowedProposal(tokenResourceId, nonce + 2, false);
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeSetFeeProposal(tokenResourceId, nonce + 2, 100);
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeSetFeeRecipientProposal(tokenResourceId, nonce + 2, vm.addr(2));
		vm.expectRevert("ProposalNonceTracker: Nonce must increment by 1");
		this.executeSetHandlerProposal(tokenResourceId, nonce + 2, vm.addr(2));
	}

	function test_setHandlerProposal(address newHandler) public {
		vm.assume(newHandler != address(tokenHandler));
		vm.assume(newHandler != address(0));
		this.executeSetHandlerProposal(tokenResourceId, token.proposalNonce() + 1, newHandler);
		assertEq(token.handler(), newHandler);
	}

	// Wrapping fee and treasury rescue fund flow
	// 1. Set fee to 1%
	// 2. Set fee recipient to treasury
	// 3. Wrap token (user gets WRAP tokens)
	// 4. Verify treasury has 1% of wrap amount (ETH)
	// 5. Verify tokenWrapper has 99% of wrap amount (ETH)
	// 6. Rescue fee revenue from treasury and send to tokenWrapper
	function test_setWrapFeeAndTreasuryRescueFundFlow() public {
		// 1. Set fee to 1%
		this.executeSetFeeProposal(tokenResourceId, token.proposalNonce() + 1, 100);
		// 2. Set fee recipient to treasury
		this.executeSetFeeRecipientProposal(
			tokenResourceId,
			token.proposalNonce() + 1,
			address(treasury)
		);
		// 3. Wrap 10 tokens
		uint256 amountToWrap = token.getAmountToWrap(10 ether);
		uint256 costToWrap = token.getFeeFromAmount(amountToWrap);
		vm.deal(vm.addr(2), amountToWrap);
		vm.prank(vm.addr(2));
		token.wrap{ value: amountToWrap }(address(0x0), 0);
		// 4. Verify treasury has 0.1 tokens
		assertEq(address(treasury).balance, costToWrap);
		// 5. Verify tokenWrapper has the right tokens
		assertEq(token.balanceOf(address(vm.addr(2))), 10 ether);
		// 6. Rescue 10 tokens from treasury
		this.executeRescueTokensProposal(
			treasuryResourceId,
			uint32(treasury.proposalNonce()) + 1,
			address(0),
			address(0x1234),
			costToWrap
		);
		// 7. Verify treasury has 0 tokens
		assertEq(address(treasury).balance, 0);
		// 8. Verify tokenWrapper has 10 tokens
		assertEq(address(0x1234).balance, costToWrap);
	}
}
