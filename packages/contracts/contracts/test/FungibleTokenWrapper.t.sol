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

	function test_setup() public {
		assertEq(token.isNativeAllowed(), true);
		assertEq(token.name(), "TOKEN");
		assertEq(token.symbol(), "TKN");
		assertEq(token.initialized(), true);
		assertEq(token.handler(), address(tokenHandler));
		assertEq(token.feeRecipient(), alice);
		assertEq(token.feePercentage(), 0);
	}

	function test_wrapNative() public {
		uint256 amount = 10 ether;
		vm.prank(alice);
		token.wrap{value: amount}(address(0x0), 0);
		assertEq(token.balanceOf(alice), amount);
		assertEq(token.totalSupply(), amount);
	}

	function test_addToken() public {
		address tokenAddress = vm.addr(2);
		vm.prank(alice);
		token.add(tokenAddress, 1);
		assertEq(token.tokens(0), tokenAddress);
		assertEq(token.valid(tokenAddress), true);
		assertEq(token.historicalTokens(0), tokenAddress);
		assertEq(token.historicallyValid(tokenAddress), true);
	}

	function test_removeToken() public {
		address tokenAddress = vm.addr(2);
		vm.prank(alice);
		token.add(tokenAddress, 1);
		vm.prank(alice);
		token.remove(tokenAddress, 2);
		assertEq(token.valid(tokenAddress), false);
		assertEq(token.historicalTokens(0), tokenAddress);
		assertEq(token.historicallyValid(tokenAddress), true);
	}

	function test_wrapERC20() public {
		uint256 amount = 10 ether;
		ERC20PresetMinterPauser newToken = new ERC20PresetMinterPauser("BASE", "BASE");
		newToken.mint(alice, amount);
		vm.prank(alice);
		token.add(address(newToken), 1);
		vm.prank(alice);
		newToken.approve(address(token), amount);
		vm.prank(alice);
		token.wrap(address(newToken), amount);
		assertEq(token.balanceOf(alice), amount);
		assertEq(token.totalSupply(), amount);
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
		token.wrap{value: amount}(address(0x0), 0);
	}

	function test_wrapERC20ShouldFailIfNotValidToken() public {
		uint256 amount = 10 ether;
		address tokenAddress = vm.addr(2);
		vm.expectRevert("TokenWrapper: Invalid token address");
		vm.prank(alice);
		token.wrap(tokenAddress, amount);
	}
}