/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./NftTokenWrapper.sol";
import "./MultiTokenManagerBase.sol";

/**
    @title A MultiNftTokenManager manages NftTokenWrapper systems
    using an external `governor` address
    @author Webb Technologies.
 */
contract MultiNftTokenManager is MultiTokenManagerBase {
    using SafeMath for uint256;

    constructor(
        address _registry,
        address _governor,
        address _feeRecipient
    ) MultiTokenManagerBase(_registry, _governor, _feeRecipient) {}

    function registerToken(
        string memory,
        string memory,
        bytes32,
        uint256,
        bool
    ) override public view onlyRegistry returns (address) {
        revert();
    }

    /**
        Registers an NFT token
     */
    function registerNftToken(
        string memory _uri,
        bytes32 _salt
    ) override external onlyRegistry returns (address) {
        NftTokenWrapper nftWrapper = new NftTokenWrapper{salt: _salt}(_uri);

        nftWrapper.initialize(governor);

        wrappedTokens.push(address(nftWrapper));
        return address(nftWrapper);
    }
}
