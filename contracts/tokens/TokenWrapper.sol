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
import "./CompToken.sol";

/**
    @title Manages deposited ERC20s.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with ERC20Handler contract.
 */
abstract contract TokenWrapper is CompToken {
    using SafeMath for uint256;

    constructor(string memory name, string memory symbol)
        CompToken(name, symbol) {}

    /**
        @notice Used to transfer tokens into the safe to fund proposals.
        @param tokenAddress Address of ERC20 to transfer.
        @param amount Amount of tokens to transfer.
     */
    function wrap(address tokenAddress, uint256 amount) public {
        require(_isValid(tokenAddress), "Invalid token address");
        // transfer liquidity to tthe token wrapper
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        // mint the wrapped token for the sender
        mint(msg.sender, amount);
    }

    /**
        @notice Used to unwrap/burn the wrapper token.
        @param tokenAddress Address of ERC20 to unwrap into.
        @param amount Amount of tokens to burn.
     */
    function unwrap(address tokenAddress, uint256 amount) public {
        require(_isValid(tokenAddress), "Invalid token address");
        // burn wrapped token from sender
        burnFrom(msg.sender, amount);
        // transfer liquidity from the token wrapper to the sender
        ERC20PresetMinterPauser(tokenAddress).transferFrom(address(this), msg.sender, amount);
    }

    /** @dev this function is defined in a child contract */
    function _isValid(address tokenAddress) internal virtual returns (bool);
}
