/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ITreasury.sol";

contract Treasury is ITreasury {
    uint256 public proposalNonce = 0;
    address treasuryHandler;

    constructor (address _treasuryHandler) {
        treasuryHandler = _treasuryHandler;
    }

    modifier onlyHandler() {
        require(msg.sender == treasuryHandler, "Function can only be called by treasury handler");
        _;
    }

    function rescueTokens(address tokenAddress, address payable to, uint256 amountToRescue, uint256 nonce) external override onlyHandler {
        require(to != address(0), "Cannot send liquidity to zero address");
        require(tokenAddress != address(this), "Cannot rescue wrapped asset");
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce <= proposalNonce + 1, "Nonce must increment by 1");

        if (tokenAddress == address(0)) {
            // Native Ether 
            uint256 ethBalance = address(this).balance;
            if(ethBalance >= amountToRescue) {
                to.transfer(amountToRescue);
            } else {
                to.transfer(ethBalance);
            }
            
        } else {
            // ERC20 Token
            uint256 erc20Balance = IERC20(tokenAddress).balanceOf(address(this));
            if(erc20Balance >= amountToRescue) {
                IERC20(tokenAddress).transfer(to, amountToRescue);
            } else {
                IERC20(tokenAddress).transfer(to, erc20Balance);
            }  
        }

        proposalNonce = nonce;
    }

    function setHandler(address newHandler, uint256 nonce) onlyHandler override external {
        require(newHandler != address(0), "Handler cannot be 0");
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce <= proposalNonce + 1, "Nonce must increment by 1");
        treasuryHandler = newHandler;
        proposalNonce = nonce;
    }

    receive() external payable {}
}
