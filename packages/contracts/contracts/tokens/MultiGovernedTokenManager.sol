/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./GovernedTokenWrapper.sol";
import "./MultiTokenManagerBase.sol";

/**
    @title A MultiGovernedTokenManager manages GovernedTokenWrapper systems
    using an external `governor` address.
    @author Webb Technologies.
 */
contract MultiGovernedTokenManager is MultiTokenManagerBase {
    using SafeMath for uint256;

    constructor(
        address _registry,
        address _governor,
        address _feeRecipient
    ) MultiTokenManagerBase(_registry, _governor, _feeRecipient) {}

    /**
        @notice Registers a new token and deploys the GovernedTokenWrapper contract
        @param _name The name of the ERC20
        @param _symbol The symbol of the ERC20
        @param _limit The maximum amount of tokens that can be wrapped
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
        @param _salt Salt used for matching addresses across chain using CREATE2
     */
    function registerToken(
        string memory _name,
        string memory _symbol,
        bytes32 _salt,
        uint256 _limit,
        bool _isNativeAllowed
    ) override external onlyRegistry returns (address) {
        GovernedTokenWrapper governedToken = new GovernedTokenWrapper{salt: _salt}(
            _name,
            _symbol
        );

        governedToken.initialize(
            payable(masterFeeRecipient),
            governor,
            _limit,
            _isNativeAllowed
        );

        wrappedTokens.push(address(governedToken));
        return address(governedToken);
    }

    /**
        Registers an NFT token
     */
    function registerNftToken(
        string memory,
        bytes32
    ) override public view onlyRegistry returns (address) {
        revert();
    }
}
