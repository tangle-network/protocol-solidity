/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ITreasury.sol";
import "./utils/ProposalNonceTracker.sol";

contract Treasury is ITreasury, ProposalNonceTracker {
	using SafeERC20 for IERC20;
	address treasuryHandler;

	event TreasuryHandlerUpdated(address _handler);

	constructor(address _treasuryHandler) {
		require(_treasuryHandler != address(0), "Treasury Handler can't be 0");
		treasuryHandler = _treasuryHandler;
	}

	modifier onlyHandler() {
		require(msg.sender == treasuryHandler, "Function can only be called by treasury handler");
		_;
	}

	function rescueTokens(
		address tokenAddress,
		address payable to,
		uint256 amountToRescue,
		uint32 nonce
	) external override onlyHandler onlyIncrementingByOne(nonce) {
		require(to != address(0), "Cannot send liquidity to zero address");
		require(tokenAddress != address(this), "Cannot rescue wrapped asset");

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
}
