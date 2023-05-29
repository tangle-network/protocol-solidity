/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/universal-router/contracts/interfaces/IUniversalRouter.sol";
import "@uniswap/universal-router/contracts/libraries/Commands.sol";
import "./interfaces/ITreasury.sol";
import "./utils/ProposalNonceTracker.sol";

contract Treasury is ITreasury, ProposalNonceTracker {
	using SafeERC20 for IERC20;
	address treasuryHandler;
	
	address UNISWAP_ROUTER;

	event TreasuryHandlerUpdated(address _handler);

	constructor(address _treasuryHandler) {
		require(_treasuryHandler != address(0), "Treasury Handler can't be 0");
		treasuryHandler = _treasuryHandler;
	}

	modifier onlyHandler() {
		require(msg.sender == treasuryHandler, "Function can only be called by treasury handler");
		_;
	}

	function swapRescueTokens(
		address tokenAddress,
		address payable to,
		uint256 amountToSwap,
		uint256 minAmountToReceive,
		uint32 nonce,
		address swapToken
	) external override onlyHandler onlyIncrementingByOne(nonce) {
		require(to != address(0), "Treasury: Cannot send liquidity to zero address");
		require(tokenAddress != address(this), "Treasury: Invalid token address specified");
		require(swapToken != address(0), "Treasury: Invalid swap token address specified");
		require(amountToSwap > 0, "Treasury: Amount to swap must be greater than 0");

		swap(
			tokenAddress,
			swapToken,
			amountToSwap,
			minAmountToReceive,
			to
		);
	}

	function rescueTokens(
		address tokenAddress,
		address payable to,
		uint256 amountToRescue,
		uint32 nonce
	) external override onlyHandler onlyIncrementingByOne(nonce) {
		require(to != address(0), "Treasury: Cannot send liquidity to zero address");
		require(tokenAddress != address(this), "Treasury: Invalid token address specified");
		require(amountToRescue > 0, "Treasury: Amount to rescue must be greater than 0");
		
		if (tokenAddress == address(0)) {
			// Native Ether
			uint256 ethBalance = address(this).balance;
			if (ethBalance >= amountToRescue) {
				to.transfer(amountToRescue);
			} else {
				to.transfer(ethBalance);
			}
		} else {
			// ERC20 Token
			uint256 erc20Balance = IERC20(tokenAddress).balanceOf(address(this));
			if (erc20Balance >= amountToRescue) {
				IERC20(tokenAddress).safeTransfer(to, amountToRescue);
			} else {
				IERC20(tokenAddress).safeTransfer(to, erc20Balance);
			}
		}
	}

	function setHandler(
		address newHandler,
		uint32 nonce
	) external override onlyHandler onlyIncrementingByOne(nonce) {
		require(newHandler != address(0), "Handler cannot be 0");
		treasuryHandler = newHandler;
		emit TreasuryHandlerUpdated(treasuryHandler);
	}

	receive() external payable {}

	function swap(
		address _tokenIn,
		address _tokenOut,
		uint256 _amountIn,
		uint256 _minAmountOut,
		address _recipient
	) external {
		bytes memory commands = abi.encodePacked(bytes1(uint8(Commands.V3_SWAP_EXACT_IN)));
		address[] memory path = new address[](2);
		path[0] = _tokenIn;
		path[1] = _tokenOut;
		bytes[] memory inputs = new bytes[](1);
		inputs[0] = abi.encode(
			address(_recipient),
			_amountIn,
			_minAmountOut,
			path,
			true
		);

		IUniversalRouter(UNISWAP_ROUTER).execute(commands, inputs);
	}
}
