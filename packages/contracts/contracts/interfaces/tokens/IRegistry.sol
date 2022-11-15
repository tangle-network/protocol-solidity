/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
    @title A MultiTokenManager manages GovernedTokenWrapper systems using an external `governor` address
    @author Webb Technologies.
 */
interface IRegistry {
    /**
        @notice Registers a new token and deploys the GovernedTokenWrapperInitializable contract
        @param _nonce The nonce of the proposal
        @param _name The name of the ERC20
        @param _symbol The symbol of the ERC20
        @param _salt Salt used for matching addresses across chain using CREATE2
        @param _limit The maximum amount of tokens that can be wrapped
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
     */
    function registerToken(
        uint32 _nonce,
        bytes32 _name,
        bytes32 _symbol,
        bytes32 _salt,
        uint256 _limit,
        bool _isNativeAllowed
    ) external;

    /**
        @notice Registers a new NFT token and deploys the NftTokenWrapper contract
        @param _nonce The nonce of the proposal
        @param _uri The uri for the wrapped NFT
        @param _salt Salt used for matching addresses across chain using CREATE2
     */
    function registerNftToken(
        uint32 _nonce,
        bytes memory _uri,
        bytes32 _salt
    ) external;
}
