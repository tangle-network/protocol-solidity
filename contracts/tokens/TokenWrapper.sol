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
    @notice This contract is intended to be used with TokenHandler contract.
 */
abstract contract TokenWrapper is ERC20PresetMinterPauser, ITokenWrapper {
    using SafeMath for uint256;
    uint8 feePercentage;
    address payable feeRecipient;

    constructor(string memory name, string memory symbol)
        ERC20PresetMinterPauser(name, symbol) {}

    function getFeeFromAmount(uint amountToWrap) override public view returns (uint) {
		return amountToWrap.mul(feePercentage).div(100);
    }

    function getAmountToWrap(uint deposit) override public view returns (uint) {
		return deposit.mul(100).div(100 - feePercentage);
    }

    /**
        @notice Used to wrap tokens on behalf of a sender. Must be called by a minter role.
        @param tokenAddress Address of ERC20 to transfer.
        @param amount Amount of tokens to transfer.
     */
    function wrap(
        address tokenAddress,
        uint256 amount
    ) override payable public isValidWrapping(tokenAddress, feeRecipient, amount) {
        uint costToWrap = getFeeFromAmount(tokenAddress == address(0)
            ? msg.value
            : amount
        );

         uint leftover = tokenAddress == address(0)
            ? uint(msg.value).sub(costToWrap)
            : amount.sub(costToWrap);
        
        if (tokenAddress == address(0)) {
            // mint the native value sent to the contract
            _mint(_msgSender(), leftover);

            // transfer costToWrap to the feeRecipient
            feeRecipient.transfer(costToWrap);
        } else {
            // transfer liquidity to the token wrapper
            IERC20(tokenAddress).transferFrom(_msgSender(), address(this), leftover);
            // transfer fee (costToWrap) to the feeRecipient
            IERC20(tokenAddress).transferFrom(_msgSender(), feeRecipient, costToWrap);
            // mint the wrapped token for the sender
            _mint(_msgSender(), leftover);
        }
    }

    /**
        @notice Used to unwrap/burn the wrapper token on behalf of a sender.
        @param tokenAddress Address of ERC20 to unwrap into.
        @param amount Amount of tokens to burn.
     */
    function unwrap(
        address tokenAddress,
        uint256 amount
    ) override public isValidUnwrapping(tokenAddress, amount) {
        // burn wrapped token from sender
        _burn(_msgSender(), amount);
        // unwrap liquidity and send to the sender
        if (tokenAddress == address(0)) {
            // transfer native liquidity from the token wrapper to the sender
            payable(msg.sender).transfer(amount);
        } else {
            // transfer ERC20 liquidity from the token wrapper to the sender
            IERC20(tokenAddress).transfer(_msgSender(), amount);
        }
    }

    /**
        @notice Used to unwrap/burn the wrapper token on behalf of a sender.
        @param tokenAddress Address of ERC20 to unwrap into.
        @param amount Amount of tokens to burn.
     */
    function unwrapAndSendTo(
        address tokenAddress,
        uint256 amount,
        address recipient
    ) override public isValidUnwrapping(tokenAddress, amount) {
        // burn wrapped token from sender
        _burn(_msgSender(), amount);
        // unwrap liquidity and send to the sender
        if (tokenAddress == address(0)) {
            // transfer native liquidity from the token wrapper to the sender
            payable(recipient).transfer(amount);
        } else {
            // transfer ERC20 liquidity from the token wrapper to the sender
            IERC20(tokenAddress).transfer(recipient, amount);
        }
    }

    /**
        @notice Used to wrap tokens on behalf of a sender
        @param sender Address of sender where assets are sent from.
        @param tokenAddress Address of ERC20 to transfer.
        @param amount Amount of tokens to transfer.
     */
    function wrapFor(
        address sender,
        address tokenAddress,
        uint256 amount
    ) override payable public isMinter() isValidWrapping(tokenAddress, feeRecipient, amount) {
        uint costToWrap = getFeeFromAmount(tokenAddress == address(0)
            ? msg.value
            : amount
        );
        uint leftover = tokenAddress == address(0)
            ? uint(msg.value).sub(costToWrap)
            : amount.sub(costToWrap);
        if (tokenAddress == address(0)) {
            mint(sender, leftover);
            // transfer fee (costToWrap) to feeRecipient 
            feeRecipient.transfer(costToWrap);
        } else {
            // transfer liquidity to the token wrapper
            IERC20(tokenAddress).transferFrom(sender, address(this), leftover);
            // transfer fee (costToWrap) to feeRecipient
            IERC20(tokenAddress).transferFrom(sender, feeRecipient, costToWrap);
            // mint the wrapped token for the sender
            mint(sender, leftover);
        }
    }

    /**
        @notice Used to wrap tokens on behalf of a sender and mint to a potentially different address
        @param sender Address of sender where assets are sent from.
        @param tokenAddress Address of ERC20 to transfer.
        @param amount Amount of tokens to transfer.
        @param recipient Recipient of the wrapped tokens.
     */
    function wrapForAndSendTo(
        address sender,
        address tokenAddress,
        uint256 amount,
        address recipient
    ) override payable public isMinter() isValidWrapping(tokenAddress, feeRecipient, amount) {
        uint costToWrap = getFeeFromAmount(tokenAddress == address(0)
            ? msg.value
            : amount
        );
        uint leftover = tokenAddress == address(0)
            ? uint(msg.value).sub(costToWrap)
            : amount.sub(costToWrap);
        if (tokenAddress == address(0)) {
            mint(recipient, leftover);
            // transfer fee (costToWrap) to feeRecipient
            feeRecipient.transfer(costToWrap);
        } else {
            // transfer liquidity to the token wrapper
            IERC20(tokenAddress).transferFrom(sender, address(this), leftover);
            // transfer fee (costToWrap) to feeRecipient
            IERC20(tokenAddress).transferFrom(sender, feeRecipient, costToWrap);
            // mint the wrapped token for the recipient
            mint(recipient, leftover);
        }
    }

    /**
        @notice Used to unwrap/burn the wrapper token.
        @param tokenAddress Address of ERC20 to unwrap into.
        @param amount Amount of tokens to burn.
     */
    function unwrapFor(
        address sender,
        address tokenAddress,
        uint256 amount
    ) override public isMinter() isValidUnwrapping(tokenAddress, amount) {
        // burn wrapped token from sender
        _burn(sender, amount);
        if (tokenAddress == address(0)) {
            payable(sender).transfer(amount);
        } else {
            // transfer liquidity from the token wrapper to the sender
            IERC20(tokenAddress).transfer(sender, amount);
        }
    }

    /** @dev this function is defined in a child contract */
    function _isValidAddress(address tokenAddress) internal virtual returns (bool);

    /** @dev this function is defined in a child contract */
    function _isValidHistoricalAddress(address tokenAddress) internal virtual returns (bool);

    /** @dev this function is defined in a child contract */
    function _isNativeValid() internal virtual returns (bool);

    /** @dev this function is defined in a child contract */
    function _isValidAmount(uint256 amount) internal virtual returns (bool);

    modifier isMinter() {
        require(hasRole(MINTER_ROLE, msg.sender), "ERC20PresetMinterPauser: must have minter role");
        _;
    }

    modifier isValidWrapping(address tokenAddress, address _feeRecipient, uint256 amount) {
        if (tokenAddress == address(0)) {
            require(amount == 0, "Invalid amount provided for native wrapping");
            require(_isNativeValid(), "Native wrapping is not allowed for this token wrapper");
        } else if (_feeRecipient == address(0)) {
            revert("Fee Recipient cannot be zero address");
        } else {
            require(msg.value == 0, "Invalid value sent for wrapping");
            require(_isValidAddress(tokenAddress), "Invalid token address");
        }
        
        require(_isValidAmount(amount), "Invalid token amount");
        _;
    }

    modifier isValidUnwrapping(address tokenAddress, uint256 amount) {
        if (tokenAddress == address(0)) {
            require(address(this).balance >= amount, "Insufficient native balance");
            require(_isNativeValid(), "Native unwrapping is not allowed for this token wrapper");
        } else {
            require(IERC20(tokenAddress).balanceOf(address(this)) >= amount, "Insufficient ERC20 balance");
            require(_isValidHistoricalAddress(tokenAddress), "Invalid historical token address");
        }

        _;
    }
}
