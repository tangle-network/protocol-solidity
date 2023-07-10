/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity >=0.8.19 <0.9.0;

import { PRBTest } from "@prb/test/PRBTest.sol";
import { console2 } from "forge-std/console2.sol";
import { StdCheats } from "forge-std/StdCheats.sol";
import { ERC20PresetMinterPauser } from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

import { TokenWrapperHandler } from "../handlers/TokenWrapperHandler.sol";
import { FungibleTokenWrapper } from "../tokens/FungibleTokenWrapper.sol";

contract FungibleTokenWrapperTest is PRBTest, StdCheats {
	FungibleTokenWrapper token;

	address alice;
	address governor;
	address tokenHandler;

	function setUp() public virtual {
		alice = vm.addr(1);
		governor = alice;
		tokenHandler = alice;
		payable(alice).transfer(1000 ether);

		token = new FungibleTokenWrapper("TOKEN", "TKN");
		uint16 feePercentage = 0;
		address feeRecipient = alice;
		address handler = address(tokenHandler);
		uint256 limit = 100 ether;
		bool isNativeAllowed = true;
		address admin = alice;
		token.initialize(feePercentage, feeRecipient, handler, limit, isNativeAllowed, admin);
	}

	function test_initialize() public {
		FungibleTokenWrapper new_token = new FungibleTokenWrapper("TOKEN", "TKN");
		uint16 feePercentage = 0;
		address feeRecipient = alice;
		address handler = address(tokenHandler);
		uint256 limit = 100 ether;
		bool isNativeAllowed = true;
		address admin = alice;
		new_token.initialize(feePercentage, feeRecipient, handler, limit, isNativeAllowed, admin);
	}

	function test_shouldFailIfUninitialized() public {
		FungibleTokenWrapper new_token = new FungibleTokenWrapper("TOKEN", "TKN");
		vm.expectRevert("Initialized: Not initialized");
		new_token.wrap(address(0x0), 0);
	}

	function test_setup() public {
		assertEq(token.isNativeAllowed(), true);
		assertEq(token.name(), "TOKEN");
		assertEq(token.symbol(), "TKN");
		assertEq(token.initialized(), true);
		assertEq(token.handler(), address(tokenHandler));
		assertEq(token.feeRecipient(), alice);
		assertEq(token.feePercentage(), 0);
	}

	function test_calculateAmountToWrapProperly(uint16 fee) public {
		vm.assume(fee < 10000);
		uint256 amount = 10 ether;
		uint256 amountToWrap = token.getAmountToWrap(amount);
		// Default fee for tests is 0
		assertEq(amount, amountToWrap);
		// Set fee to be 1 percent (100 / 10000 = 0.01)
		vm.prank(alice);
		token.setFee(fee, 1);
		amountToWrap = token.getAmountToWrap(amount);
		// Amount to wrap should be (100 / 99) * amount
		assertEq(amountToWrap, (amount * 10000) / (10000 - fee));
		// Set fee to be 100 percent (10000 / 10000 = 1) shouldn't work
		vm.expectRevert("FungibleTokenWrapper: Invalid fee percentage");
		vm.prank(alice);
		token.setFee(10000, 2);
	}

	function test_wrapNative() public {
		uint256 amount = 10 ether;
		vm.prank(alice);
		token.wrap{ value: amount }(address(0x0), 0);
		assertEq(token.balanceOf(alice), amount);
		assertEq(token.totalSupply(), amount);
	}

	function test_addToken() public {
		assertEq(token.getProposalNonce(), 0);
		address tokenAddress = vm.addr(2);
		vm.prank(alice);
		token.add(tokenAddress, 1);
		assertEq(token.getProposalNonce(), 1);
		assertEq(token.tokens(0), tokenAddress);
		assertEq(token.valid(tokenAddress), true);
		assertEq(token.historicalTokens(0), tokenAddress);
		assertEq(token.historicallyValid(tokenAddress), true);
	}

	function test_removeToken() public {
		assertEq(token.getProposalNonce(), 0);
		address tokenAddress = vm.addr(2);
		vm.prank(alice);
		token.add(tokenAddress, 1);
		assertEq(token.getProposalNonce(), 1);
		vm.prank(alice);
		token.remove(tokenAddress, 2);
		assertEq(token.getProposalNonce(), 2);
		assertEq(token.valid(tokenAddress), false);
		assertEq(token.historicalTokens(0), tokenAddress);
		assertEq(token.historicallyValid(tokenAddress), true);
	}

	function test_wrapERC20() public {
		assertEq(token.getProposalNonce(), 0);
		uint256 amount = 10 ether;
		ERC20PresetMinterPauser newToken = new ERC20PresetMinterPauser("BASE", "BASE");
		newToken.mint(alice, amount);
		vm.prank(alice);
		token.add(address(newToken), 1);
		assertEq(token.getProposalNonce(), 1);
		vm.prank(alice);
		newToken.approve(address(token), amount);
		vm.prank(alice);
		token.wrap(address(newToken), amount);
		assertEq(token.balanceOf(alice), amount);
		assertEq(token.totalSupply(), amount);
	}

	function test_wrapUnwrapNative() public {
		uint256 aliceBalance = address(alice).balance;
		uint256 amount = 10 ether;
		vm.prank(alice);
		token.wrap{ value: amount }(address(0x0), 0);
		assertEq(token.balanceOf(alice), amount);
		assertEq(token.totalSupply(), amount);
		assertEq(address(alice).balance, aliceBalance - amount);
		vm.prank(alice);
		token.unwrap(address(0x0), amount);
		assertEq(token.balanceOf(alice), 0);
		assertEq(token.totalSupply(), 0);
		assertEq(address(alice).balance, aliceBalance);
	}

	function test_wrapUnwrapERC20() public {
		uint256 amount = 10 ether;
		ERC20PresetMinterPauser newToken = new ERC20PresetMinterPauser("BASE", "BASE");
		newToken.mint(alice, amount);
		uint256 aliceBalance = newToken.balanceOf(alice);
		vm.prank(alice);
		token.add(address(newToken), 1);
		vm.prank(alice);
		newToken.approve(address(token), amount);
		vm.prank(alice);
		token.wrap(address(newToken), amount);
		assertEq(token.balanceOf(alice), amount);
		assertEq(token.totalSupply(), amount);
		assertEq(newToken.balanceOf(alice), aliceBalance - amount);
		vm.prank(alice);
		token.unwrap(address(newToken), amount);
		assertEq(token.balanceOf(alice), 0);
		assertEq(token.totalSupply(), 0);
		assertEq(newToken.balanceOf(alice), aliceBalance);
	}

	function test_wrapForNative() public {
		uint256 amount = 10 ether;
		address bob = vm.addr(2);
		vm.prank(alice);
		token.wrapFor{ value: amount }(bob, address(0x0), 0);
		assertEq(token.balanceOf(alice), 0);
		assertEq(token.balanceOf(bob), amount);
		assertEq(token.totalSupply(), amount);
	}

	function test_wrapForERC20() public {
		uint256 amount = 10 ether;
		address bob = vm.addr(2);
		ERC20PresetMinterPauser newToken = new ERC20PresetMinterPauser("BASE", "BASE");
		newToken.mint(bob, amount);
		vm.prank(alice);
		token.add(address(newToken), 1);
		vm.prank(bob);
		newToken.approve(address(token), amount);
		vm.prank(alice);
		token.wrapFor(bob, address(newToken), amount);
		assertEq(token.balanceOf(alice), 0);
		assertEq(token.balanceOf(bob), amount);
		assertEq(token.totalSupply(), amount);
	}

	function test_unwrapForNative() public {
		uint256 amount = 10 ether;
		address bob = vm.addr(2);
		vm.prank(alice);
		token.wrapFor{ value: amount }(bob, address(0x0), 0);
		assertEq(token.balanceOf(alice), 0);
		assertEq(token.balanceOf(bob), amount);
		assertEq(token.totalSupply(), amount);
		vm.prank(alice);
		token.unwrapFor(bob, address(0x0), amount);
		assertEq(token.balanceOf(alice), 0);
		assertEq(token.balanceOf(bob), 0);
		assertEq(token.totalSupply(), 0);
		assertEq(address(bob).balance, amount);
	}

	function test_unwrapForERC20() public {
		uint256 amount = 10 ether;
		address bob = vm.addr(2);
		ERC20PresetMinterPauser newToken = new ERC20PresetMinterPauser("BASE", "BASE");
		newToken.mint(bob, amount);
		vm.prank(alice);
		token.add(address(newToken), 1);
		vm.prank(bob);
		newToken.approve(address(token), amount);
		vm.prank(alice);
		token.wrapFor(bob, address(newToken), amount);
		assertEq(token.balanceOf(alice), 0);
		assertEq(token.balanceOf(bob), amount);
		assertEq(token.totalSupply(), amount);
		vm.prank(alice);
		token.unwrapFor(bob, address(newToken), amount);
		assertEq(token.balanceOf(alice), 0);
		assertEq(token.balanceOf(bob), 0);
		assertEq(token.totalSupply(), 0);
		assertEq(newToken.balanceOf(bob), amount);
	}

	function test_setFee(uint16 feePercentage) public {
		vm.assume(feePercentage <= 10000);
		assertEq(token.getProposalNonce(), 0);
		vm.prank(alice);
		token.setFee(feePercentage, 1);
		assertEq(token.getProposalNonce(), 1);
		assertEq(token.feePercentage(), feePercentage);
	}

	function test_setFeeRecipient(address feeRecipient) public {
		vm.assume(feeRecipient != address(0x0));
		assertEq(token.getProposalNonce(), 0);
		vm.prank(alice);
		token.setFeeRecipient(payable(feeRecipient), 1);
		assertEq(token.getProposalNonce(), 1);
		assertEq(token.feeRecipient(), feeRecipient);
	}

	function test_setFeeShouldFailIfGreaterThan10000(uint16 feePercentage) public {
		vm.assume(feePercentage > 10000);
		assertEq(token.getProposalNonce(), 0);
		vm.expectRevert("FungibleTokenWrapper: Invalid fee percentage");
		vm.prank(alice);
		token.setFee(feePercentage, 1);
		assertEq(token.getProposalNonce(), 0);
	}

	function test_setFeeRecipientShouldFailIfZero() public {
		vm.expectRevert("FungibleTokenWrapper: Fee Recipient cannot be zero address");
		vm.prank(alice);
		token.setFeeRecipient(payable(address(0x0)), 1);
	}

	function test_addTokenShouldFailIfAlreadyValid() public {
		address tokenAddress = vm.addr(2);
		vm.prank(alice);
		token.add(tokenAddress, 1);
		vm.expectRevert("FungibleTokenWrapper: Token should not be valid");
		vm.prank(alice);
		token.add(tokenAddress, 2);
	}

	function test_removeTokenShouldFailIfTokenDoesntExist() public {
		address tokenAddress = vm.addr(2);
		vm.expectRevert("FungibleTokenWrapper: Token should be valid");
		vm.prank(alice);
		token.remove(tokenAddress, 1);
	}

	function test_unwrapShouldFailIfNotHistoricallyValid() public {
		uint256 amount = 10 ether;
		ERC20PresetMinterPauser newToken = new ERC20PresetMinterPauser("BASE", "BASE");
		newToken.mint(alice, amount);
		uint256 aliceBalance = newToken.balanceOf(alice);
		vm.expectRevert("TokenWrapper: Insufficient ERC20 balance");
		vm.prank(alice);
		token.unwrap(address(newToken), amount);
	}

	function test_unwrapShouldFailIfNoLiquidity() public {
		uint256 amount = 10 ether;
		ERC20PresetMinterPauser newToken = new ERC20PresetMinterPauser("BASE", "BASE");
		newToken.mint(alice, amount);
		uint256 aliceBalance = newToken.balanceOf(alice);
		vm.prank(alice);
		token.add(address(newToken), 1);
		vm.expectRevert("TokenWrapper: Insufficient ERC20 balance");
		vm.prank(alice);
		token.unwrap(address(newToken), amount);
	}

	function test_wrapNativeShouldFailIfNotPassedAsValue() public {
		uint256 amount = 10 ether;
		// Fail to do it when amount is passed in as if its ERC20
		vm.expectRevert("TokenWrapper: Invalid amount provided for native wrapping");
		vm.prank(alice);
		token.wrap(address(0x0), amount);
	}

	function test_wrapNativeShouldFailIfNotNativeAllowed() public {
		uint256 amount = 10 ether;
		vm.prank(alice);
		token.setNativeAllowed(false);
		vm.expectRevert("TokenWrapper: Native wrapping is not allowed for this token wrapper");
		vm.prank(alice);
		token.wrap{ value: amount }(address(0x0), 0);
	}

	function test_wrapERC20ShouldFailIfNotValidToken() public {
		uint256 amount = 10 ether;
		address tokenAddress = vm.addr(2);
		vm.expectRevert("TokenWrapper: Invalid token address");
		vm.prank(alice);
		token.wrap(tokenAddress, amount);
	}

	function test_wrapERC20ShouldFailIfNotEnoughBalance() public {
		uint256 amount = 10 ether;
		address bob = vm.addr(2);
		ERC20PresetMinterPauser newToken = new ERC20PresetMinterPauser("BASE", "BASE");
		newToken.mint(bob, amount);
		vm.prank(alice);
		token.add(address(newToken), 1);
		vm.prank(bob);
		newToken.approve(address(token), amount + 1);
		vm.expectRevert("ERC20: transfer amount exceeds balance");
		vm.prank(bob);
		token.wrap(address(newToken), amount + 1);
	}

	function test_wrapForShouldFailIfNoAllowance() public {
		uint256 amount = 10 ether;
		address bob = vm.addr(2);
		ERC20PresetMinterPauser newToken = new ERC20PresetMinterPauser("BASE", "BASE");
		newToken.mint(bob, amount);
		vm.prank(alice);
		token.add(address(newToken), 1);
		vm.expectRevert("ERC20: insufficient allowance");
		vm.prank(alice);
		token.wrapFor(bob, address(newToken), amount);
	}

	function test_wrapForERC20ShouldFailIfNotMinter() public {
		uint256 amount = 10 ether;
		address bob = vm.addr(2);
		address charlie = vm.addr(3);
		ERC20PresetMinterPauser newToken = new ERC20PresetMinterPauser("BASE", "BASE");
		newToken.mint(bob, amount);
		vm.prank(alice);
		token.add(address(newToken), 1);
		vm.prank(bob);
		newToken.approve(address(token), amount);
		vm.expectRevert("TokenWrapper: must have minter role");
		vm.prank(charlie);
		token.wrapFor(bob, address(newToken), amount);
	}

	function test_unwrapForERC20ShouldFailIfNotMinter() public {
		uint256 amount = 10 ether;
		address bob = vm.addr(2);
		address charlie = vm.addr(3);
		ERC20PresetMinterPauser newToken = new ERC20PresetMinterPauser("BASE", "BASE");
		newToken.mint(bob, amount);
		vm.prank(alice);
		token.add(address(newToken), 1);
		vm.prank(bob);
		newToken.approve(address(token), amount);
		vm.expectRevert("TokenWrapper: must have minter role");
		vm.prank(charlie);
		token.wrapFor(bob, address(newToken), amount);
		// Wrap for Bob with the minter role (Alice)
		vm.prank(alice);
		token.wrapFor(bob, address(newToken), amount);
		vm.expectRevert("TokenWrapper: must have minter role");
		vm.prank(charlie);
		token.unwrapFor(bob, address(newToken), amount);
	}
}
