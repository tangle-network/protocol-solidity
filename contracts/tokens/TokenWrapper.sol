/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "../interfaces/ITokenWrapper.sol";
import "./CompToken.sol";

/**
    @title Manages deposited ERC20s.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with ERC20Handler contract.
 */
abstract contract TokenWrapper is CompToken, ITokenWrapper {
    using SafeMath for uint256;

    constructor(string memory name, string memory symbol)
        CompToken(name, symbol) {}

    /**
        @notice Used to transfer tokens into the safe to fund proposals.
        @param sender address which wraps and unwraps tokens
        @param tokenAddress Address of ERC20 to transfer.
        @param amount Amount of tokens to transfer.
     */
    function wrap(address sender, address tokenAddress, uint256 amount) public override{
        require(hasRole(MINTER_ROLE, msg.sender), "ERC20PresetMinterPauser: must have minter role");
        require(isValidAddress(tokenAddress), "Invalid token address");
        require(isValidAmount(amount), "Invalid token amount");
        // transfer liquidity to the token wrapper
        IERC20(tokenAddress).transferFrom(sender, address(this), amount);
        // mint the wrapped token for the sender
        mint(sender, amount);
    }

    /**
        @notice Used to transfer tokens wrapped tokens into the anchor on deposit.
        @param sender Address anchor user.
        @param input struct containing tokenaddress and denomination amount.
     */
    function wrapAndDeposit(address sender, WrapAndDepositInput memory input) public override {
        require(hasRole(MINTER_ROLE, msg.sender), "ERC20PresetMinterPauser: must have minter role");
        require(isValidAddress(input.tokenAddress), "Invalid token address");
        require(isValidAmount(input.amount), "Invalid token amount");
        // transfer liquidity to the token wrapper
        IERC20(input.tokenAddress).transferFrom(sender, address(this), input.amount);
        // mint the wrapped token for the sender
        mint(msg.sender, input.amount);
    }
    
    /**
        @notice Used to unwrap/burn the wrapper token.
        @param tokenAddress Address of ERC20 to unwrap into.
        @param amount Amount of tokens to burn.
     */
    function unwrap(address sender, address tokenAddress, uint256 amount) public override {
        require(hasRole(MINTER_ROLE, msg.sender), "ERC20PresetMinterPauser: must have minter role");
        require(isValidAddress(tokenAddress), "Invalid token address");
        require(isValidAmount(amount), "Invalid token amount");
        // burn wrapped token from sender
        burnFrom(sender, amount);
        // transfer liquidity from the token wrapper to the sender
        IERC20(tokenAddress).transfer(sender, amount);
    }

    /**
        @notice Used to unwrap/burn the wrapper token.
        @param tokenAddress Address of ERC20 to unwrap into.
        @param amount Amount of tokens to burn.
     */
    function withdrawAndUnwrap(address sender, address tokenAddress, uint256 amount) public override {
        require(hasRole(MINTER_ROLE, msg.sender), "ERC20PresetMinterPauser: must have minter role");
        require(isValidAddress(tokenAddress), "Invalid token address");
        require(isValidAmount(amount), "Invalid token amount");
        // burn wrapped token from sender
        burnFrom(sender, amount);
        // transfer liquidity from the token wrapper to the sender
        IERC20(tokenAddress).transfer(sender, amount);
    }

    /** @dev this function is defined in a child contract */
    function isValidAddress(address tokenAddress) public virtual override returns (bool);

    /** @dev this function is defined in a child contract */
    function isValidAmount(uint256 amount) public virtual override returns (bool);
}
