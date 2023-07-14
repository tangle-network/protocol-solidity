/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity >=0.8.19 <0.9.0;

import { console2 } from "forge-std/console2.sol";
import { StdCheats } from "forge-std/StdCheats.sol";

import { Deployer } from "./Deployer.t.sol";

contract TreasuryHandlerTest is Deployer {
	function setUp() public virtual override {
		super.setUp();
	}

	function test_deployTreasuryHandler() public {
		assertEq(treasury.handler(), address(treasuryHandler));
		assertEq(bridge._resourceIdToHandlerAddress(treasuryResourceId), address(treasuryHandler));
		assertEq(treasuryHandler._bridgeAddress(), address(bridge));

		assertEq(
			treasuryHandler._resourceIDToContractAddress(treasuryResourceId),
			address(treasury)
		);
		assertEq(
			treasuryHandler._contractAddressToResourceID(address(treasury)),
			treasuryResourceId
		);
	}

	function test_executeRescueTokensProposal() public {
		// First send a bunch of ETH to the treasury
		uint256 ethAmount = 100 ether;
		vm.deal(address(treasury), ethAmount);
		// Now let's rescue this ETH and send to a random address.
		uint256 balanceBefore = vm.addr(2).balance;
		uint256 rescuedAmount = 50 ether;
		this.executeRescueTokensProposal(
			treasuryResourceId,
			uint32(treasury.proposalNonce()) + 1,
			address(0),
			vm.addr(2),
			rescuedAmount
		);
		// Verify the amount was rescued
		assertEq(address(treasury).balance, ethAmount - rescuedAmount);
		assertEq(vm.addr(2).balance, balanceBefore + rescuedAmount);
	}

	function test_executeRescueTokensProposalShouldFailFromNotHandler() public {
		address tokenToRescue = address(0);
		address payable recipient = payable(vm.addr(2));
		uint256 amountToRescue = 50 ether;
		uint32 nonce = uint32(treasury.proposalNonce() + 1);
		vm.deal(address(treasury), 100 ether);
		vm.expectRevert("Treasury: Function can only be called by treasury handler");
		treasury.rescueTokens(tokenToRescue, recipient, amountToRescue, nonce);
	}

	function test_setHandlerProposal(address newHandler) public {
		vm.assume(newHandler != address(treasuryHandler));
		vm.assume(newHandler != address(0));
		this.executeSetHandlerProposal(
			treasuryResourceId,
			uint32(treasury.proposalNonce()) + 1,
			newHandler
		);
		assertEq(treasury.handler(), newHandler);
	}
}
