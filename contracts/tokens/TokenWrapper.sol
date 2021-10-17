/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 
pragma solidity ^0.8.0;

import "../interfaces/ITokenWrapper.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
    @title Manages deposited ERC20s.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with ERC20Handler contract.
 */
abstract contract TokenWrapper is ERC20PresetMinterPauser, ITokenWrapper {
    using SafeMath for uint256;

    constructor(string memory name, string memory symbol)
        ERC20PresetMinterPauser(name, symbol) {}

    /**
        @notice Used to wrap tokens on behalf of a sender. Must be called by a minter role.
        @param tokenAddress Address of ERC20 to transfer.
        @param amount Amount of tokens to transfer.
     */
    function wrap(address tokenAddress, uint256 amount) override public {
        require(_isValidAddress(tokenAddress), "Invalid token address");
        require(_isValidAmount(amount), "Invalid token amount");
        // transfer liquidity to the token wrapper
        IERC20(tokenAddress).transferFrom(_msgSender(), address(this), amount);
        // mint the wrapped token for the sender
        _mint(_msgSender(), amount);
    }

    /**
        @notice Used to unwrap/burn the wrapper token on behalf of a sender.
        @param tokenAddress Address of ERC20 to unwrap into.
        @param amount Amount of tokens to burn.
     */
    function unwrap(address tokenAddress, uint256 amount) override public {
        require(_isValidAddress(tokenAddress), "Invalid token address");
        require(_isValidAmount(amount), "Invalid token amount");
        // burn wrapped token from sender
        _burn(_msgSender(), amount);
        // transfer liquidity from the token wrapper to the sender
        IERC20(tokenAddress).transfer(_msgSender(), amount);
    }

    /**
        @notice Used to wrap tokens on behalf of a sender
        @param tokenAddress Address of ERC20 to transfer.
        @param amount Amount of tokens to transfer.
     */
    function wrapFor(address sender, address tokenAddress, uint256 amount) override public {
        require(hasRole(MINTER_ROLE, msg.sender), "ERC20PresetMinterPauser: must have minter role");
        require(_isValidAddress(tokenAddress), "Invalid token address");
        require(_isValidAmount(amount), "Invalid token amount");
        // transfer liquidity to the token wrapper
        IERC20(tokenAddress).transferFrom(sender, address(this), amount);
        // mint the wrapped token for the sender
        mint(sender, amount);
    }
    /**
        @notice Used to wrap tokens and mint the wrapped tokens to a potentially different recipient
     */
    function wrapForAndSendTo(address sender, address tokenAddress, uint256 amount, address recipient) override public {
        require(hasRole(MINTER_ROLE, msg.sender), "ERC20PresetMinterPauser: must have minter role");
        require(_isValidAddress(tokenAddress), "Invalid token address");
        require(_isValidAmount(amount), "Invalid token amount");
        // transfer liquidity to the token wrapper
        IERC20(tokenAddress).transferFrom(sender, address(this), amount);
        // mint the wrapped token for the sender
        mint(recipient, amount);
    }
    /**
        @notice Used to unwrap/burn the wrapper token.
        @param tokenAddress Address of ERC20 to unwrap into.
        @param amount Amount of tokens to burn.
     */
    function unwrapFor(address sender, address tokenAddress, uint256 amount) override public {
        require(hasRole(MINTER_ROLE, msg.sender), "ERC20PresetMinterPauser: must have minter role");
        require(_isValidAddress(tokenAddress), "Invalid token address");
        require(_isValidAmount(amount), "Invalid token amount");
        // burn wrapped token from sender
        _burn(sender, amount);
        // transfer liquidity from the token wrapper to the sender
        IERC20(tokenAddress).transfer(sender, amount);
    }

    /** @dev this function is defined in a child contract */
    function _isValidAddress(address tokenAddress) internal virtual returns (bool);

    /** @dev this function is defined in a child contract */
    function _isValidAmount(uint256 amount) internal virtual returns (bool);
}
