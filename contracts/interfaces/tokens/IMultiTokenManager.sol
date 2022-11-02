/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
    @title A MultiTokenManager manages GovernedTokenWrapper systems using an external `governor` address
    @author Webb Technologies.
 */
interface IMultiTokenManager {
    /**
        @notice Registers a new token and deploys the GovernedTokenWrapperInitializable contract
        @param _name The name of the ERC20
        @param _symbol The symbol of the ERC20
        @param _limit The maximum amount of tokens that can be wrapped
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
        @param _salt Salt used for matching addresses across chain using CREATE2
     */
    function registerToken(
        string memory _name,
        string memory _symbol,
        uint256 _limit,
        bool _isNativeAllowed,
        bytes32 _salt
    ) external;

    /**
        @notice Sets the governor of the MultiTokenManager contract
        @param _governor The address of the new governor
        @notice Only the governor can call this function
     */
    function setGovernor(address _governor) external;
}
