/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 
pragma solidity ^0.8.0;

import "../../interfaces/tokens/IMultiTokenWrapper.sol";
import "./ERC1155PresetMinterPauserSupply.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
    @title A token that allows ERC20s to wrap into and mint it.
    @author Webb Technologies.
    @notice This contract is intended to be used with TokenHandler contract.
 */
abstract contract MultiTokenWrapperERC1155 is ERC1155PresetMinterPauserSupply, IMultiTokenWrapper {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    address payable public feeRecipient;

    mapping (address => uint256) wrappedTokenToTokenId;
    mapping (uint256 => address) tokenIdToWrappedToken;
    mapping (address => uint16) wrappedTokenToWrappingFeePercentage;
    mapping (address => uint256) wrappedToken;

    /**
        @notice MultiTokenWrapper constructor
        @param uri The uri for the ERC1155
        @param feeRec The address of the fee recipient
        @notice An example of the uri scheme https://token-cdn-domain/{id}.json
        @notice https://eips.ethereum.org/EIPS/eip-1155#metadata
     */
    constructor(string memory uri, address payable feeRec)
        ERC1155PresetMinterPauserSupply(uri) {
            feeRecipient = feeRec;
        }

    /**
        @notice Get the fee for a target amount to wrap
        @param toTokenAddress Address of the token to wrap into
        @param amountToWrap The amount to wrap
        @return uint The fee amount of the token being wrapped
     */
    function getFeeFromAmount(address toTokenAddress, uint amountToWrap) override public view returns (uint) {
        uint16 feePercentage = wrappedTokenToWrappingFeePercentage[toTokenAddress];
        return amountToWrap.mul(feePercentage).div(10000);
    }

    /**
        @notice Get the amount to wrap for a target `_deposit` amount
        @param toTokenAddress Address of the token to wrap into
        @param deposit The deposit amount
        @return uint The amount to wrap conditioned on the deposit amount
     */
    function getAmountToWrap(address toTokenAddress, uint deposit) override public view returns (uint) {
        uint16 feePercentage = wrappedTokenToWrappingFeePercentage[toTokenAddress];
        return deposit.mul(10000).div(10000 - feePercentage);
    }

    /**
        @notice Used to wrap tokens on behalf of a sender. Must be called by a minter role.
        @param fromTokenAddress Address of ERC20 to transfer.
        @param amount Amount of tokens to transfer.
     */
    function wrap(
        address fromTokenAddress,
        address toTokenAddress,
        uint256 amount
    ) override payable public isValidWrapping(fromTokenAddress, toTokenAddress, feeRecipient, amount) {
        uint costToWrap = getFeeFromAmount(toTokenAddress, fromTokenAddress == address(0)
            ? msg.value
            : amount
        );

         uint leftover = fromTokenAddress == address(0)
            ? uint(msg.value).sub(costToWrap)
            : amount.sub(costToWrap);
        
        if (fromTokenAddress == address(0)) {
            // transfer costToWrap to the feeRecipient
            feeRecipient.transfer(costToWrap);
        } else {
            // transfer liquidity to the token wrapper
            IERC20(fromTokenAddress).transferFrom(_msgSender(), address(this), leftover);
            // transfer fee (costToWrap) to the feeRecipient
            IERC20(fromTokenAddress).transferFrom(_msgSender(), feeRecipient, costToWrap);
        }

        uint tokenId = wrappedTokenToTokenId[toTokenAddress];
        // mint the native value sent to the contract
        _mint(_msgSender(), tokenId, leftover, "");
    }

    /**
        @notice Used to unwrap/burn the wrapper token on behalf of a sender.
        @param fromTokenAddress Address of wrapped ERC20 to unwrap from.
        @param toTokenAddress Address of ERC20 to unwrap into.
        @param amount Amount of tokens to burn.
     */
    function unwrap(
        address fromTokenAddress,
        address toTokenAddress,
        uint256 amount
    ) override public isValidUnwrapping(fromTokenAddress, toTokenAddress, amount) {
        uint tokenId = wrappedTokenToTokenId[fromTokenAddress];
        // burn wrapped token from sender
        _burn(_msgSender(), tokenId, amount);
        // unwrap liquidity and send to the sender
        if (fromTokenAddress == address(0)) {
            // transfer native liquidity from the token wrapper to the sender
            payable(msg.sender).transfer(amount);
        } else {
            // transfer ERC20 liquidity from the token wrapper to the sender
            IERC20(fromTokenAddress).transfer(_msgSender(), amount);
        }
    }

    /**
        @notice Used to unwrap/burn the wrapper token on behalf of a sender.
        @param fromTokenAddress Address of wrapped ERC20 to unwrap from.
        @param toTokenAddress Address of ERC20 to unwrap into.
        @param amount Amount of tokens to burn.
     */
    function unwrapAndSendTo(
        address fromTokenAddress,
        address toTokenAddress,
        uint256 amount,
        address recipient
    ) override public isValidUnwrapping(fromTokenAddress, toTokenAddress, amount) {
        uint tokenId = wrappedTokenToTokenId[fromTokenAddress];
        // burn wrapped token from sender
        _burn(_msgSender(), tokenId, amount);
        // unwrap liquidity and send to the sender
        if (fromTokenAddress == address(0)) {
            // transfer native liquidity from the token wrapper to the sender
            payable(recipient).transfer(amount);
        } else {
            // transfer ERC20 liquidity from the token wrapper to the sender
            IERC20(fromTokenAddress).transfer(recipient, amount);
        }
    }

    /**
        @notice Used to wrap tokens on behalf of a sender
        @param sender Address of sender where assets are sent from.
        @param fromTokenAddress Address of ERC20 to wrap.
        @param toTokenAddress Address of wrapped ERC20 to receive after wrapping.
        @param amount Amount of tokens to transfer.
     */
    function wrapFor(
        address sender,
        address fromTokenAddress,
        address toTokenAddress,
        uint256 amount
    ) override payable public isMinter() isValidWrapping(fromTokenAddress, toTokenAddress, feeRecipient, amount) {
        uint costToWrap = getFeeFromAmount(fromTokenAddress, toTokenAddress == address(0)
            ? msg.value
            : amount
        );
        uint leftover = fromTokenAddress == address(0)
            ? uint(msg.value).sub(costToWrap)
            : amount.sub(costToWrap);
        if (fromTokenAddress == address(0)) {
            // transfer fee (costToWrap) to feeRecipient 
            feeRecipient.transfer(costToWrap);
        } else {
            // transfer liquidity to the token wrapper
            IERC20(fromTokenAddress).transferFrom(sender, address(this), leftover);
            // transfer fee (costToWrap) to feeRecipient
            IERC20(fromTokenAddress).transferFrom(sender, feeRecipient, costToWrap);
        }

        uint tokenId = wrappedTokenToTokenId[toTokenAddress];
        // mint the wrapped token for the sender
        _mint(sender, tokenId, leftover, "");
    }

    /**
        @notice Used to wrap tokens on behalf of a sender and mint to a potentially different address
        @param sender Address of sender where assets are sent from.
        @param fromTokenAddress Address of ERC20 to wrap.
        @param toTokenAddress Address of wrapped ERC20 to receive after wrapping and send to `recipient`.
        @param amount Amount of tokens to transfer.
        @param recipient Recipient of the wrapped tokens.
     */
    function wrapForAndSendTo(
        address sender,
        address fromTokenAddress,
        address toTokenAddress,
        uint256 amount,
        address recipient
    ) override payable public isMinter() isValidWrapping(fromTokenAddress, toTokenAddress, feeRecipient, amount) {
        uint costToWrap = getFeeFromAmount(fromTokenAddress, toTokenAddress == address(0)
            ? msg.value
            : amount
        );
        uint leftover = fromTokenAddress == address(0)
            ? uint(msg.value).sub(costToWrap)
            : amount.sub(costToWrap);
        if (fromTokenAddress == address(0)) {
            // transfer fee (costToWrap) to feeRecipient
            feeRecipient.transfer(costToWrap);
        } else {
            // transfer liquidity to the token wrapper
            IERC20(fromTokenAddress).transferFrom(sender, address(this), leftover);
            // transfer fee (costToWrap) to feeRecipient
            IERC20(fromTokenAddress).transferFrom(sender, feeRecipient, costToWrap);
        }

        uint tokenId = wrappedTokenToTokenId[toTokenAddress];
        // mint the wrapped token for the sender
        _mint(recipient, tokenId, leftover, "");
    }

    /**
        @notice Used to unwrap/burn the wrapper token.
        @param sender The address that the caller is unwrapping for
        @param fromTokenAddress Address of wrapped ERC20 to unwrap from.
        @param toTokenAddress Address of ERC20 to unwrap into.
        @param amount Amount of tokens to burn.
     */
    function unwrapFor(
        address sender,
        address fromTokenAddress,
        address toTokenAddress,
        uint256 amount
    ) override public isMinter() isValidUnwrapping(fromTokenAddress, toTokenAddress, amount) {
        uint tokenId = wrappedTokenToTokenId[fromTokenAddress];
        // burn wrapped token from sender
        _burn(sender, tokenId, amount);
        if (fromTokenAddress == address(0)) {
            payable(sender).transfer(amount);
        } else {
            // transfer liquidity from the token wrapper to the sender
            IERC20(fromTokenAddress).transfer(sender, amount);
        }
    }

    /** @dev this function is defined in a child contract */
    function _isValidAddress(address fromTokenAddress, address toTokenAddress) internal virtual returns (bool);

    /** @dev this function is defined in a child contract */
    function _isValidHistoricalAddress(address fromTokenAddress, address toTokenAddress) internal virtual returns (bool);

    /** @dev this function is defined in a child contract */
    function _isNativeValid(address tokenAddress) internal virtual returns (bool);

    /** @dev this function is defined in a child contract */
    function _isValidAmount(address tokenAddress, uint256 amount) internal virtual returns (bool);

    modifier isMinter() {
        require(hasRole(MINTER_ROLE, msg.sender), "ERC1155PresetMinterPauserSupply: must have minter role");
        _;
    }

    /**
        @notice Modifier to check if the wrapping is valid
        @param fromTokenAddress Address of ERC20 to wrap.
        @param toTokenAddress Address of wrapped ERC20 to receive after wrapping.
        @param feeRec The fee recipient for the wrapping fee
        @param amount The amount of tokens to wrap
     */
    modifier isValidWrapping(
        address fromTokenAddress,
        address toTokenAddress,
        address feeRec,
        uint256 amount
    ) {
        if (fromTokenAddress == address(0)) {
            require(amount == 0, "Invalid amount provided for native wrapping");
            require(_isNativeValid(toTokenAddress), "Native wrapping is not allowed for this token wrapper");
        } else {
            require(msg.value == 0, "Invalid value sent for wrapping");
            require(_isValidAddress(fromTokenAddress, toTokenAddress), "Invalid token address");
        }

        require(feeRec != address(0), "Fee Recipient cannot be zero address");
        
        require(_isValidAmount(toTokenAddress, amount), "Invalid token amount");
        _;
    }

    /**
        @notice Modifier to check if the unwrapping is valid
        @param fromTokenAddress Address of wrapped ERC20 to unwrap.
        @param toTokenAddress Address of ERC20 to unwrap into.
        @param amount The amount of tokens to unwrap
     */
    modifier isValidUnwrapping(
        address fromTokenAddress,
        address toTokenAddress,
        uint256 amount
    ) {
        if (fromTokenAddress == address(0)) {
            require(address(this).balance >= amount, "Insufficient native balance");
            require(_isNativeValid(toTokenAddress), "Native unwrapping is not allowed for this token wrapper");
        } else {
            require(IERC20(fromTokenAddress).balanceOf(address(this)) >= amount, "Insufficient ERC20 balance");
            require(_isValidHistoricalAddress(fromTokenAddress, toTokenAddress), "Invalid historical token address");
        }

        _;
    }
}
