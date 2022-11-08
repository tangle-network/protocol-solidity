/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./GovernedTokenWrapper.sol";
import "./NftTokenWrapper.sol";
import "../interfaces/tokens/IMultiTokenManager.sol";

/**
    @title A MultiNftTokenManager manages NftTokenWrapper systems using an external `governor` address
    @author Webb Technologies.
 */
contract MultiNftTokenManager is IMultiTokenManager {
    using SafeMath for uint256;
    address public governor;
    address public masterFeeRecipient;

    uint256 public proposalNonce = 0;
    address[] public wrappedTokens;

    constructor() {
        governor = msg.sender;
        masterFeeRecipient = msg.sender;
    }

    function registerToken(
        string memory,
        string memory,
        bytes32,
        uint256,
        bool
    ) override external onlyGovernor returns (address) {
        revert();
    }

    /**
        Registers an NFT token
     */
    function registerNFTToken(
        string memory _uri,
        bytes32 _salt
    ) override external onlyGovernor returns (address) {
        NftTokenWrapper nftWrapper = new NftTokenWrapper{salt: _salt}(_uri);

        nftWrapper.initialize(governor);

        wrappedTokens.push(address(nftWrapper));
        return address(nftWrapper);
    }

    /**
        @notice Sets the governor of the MultiTokenManager contract
        @param _governor The address of the new governor
        @notice Only the governor can call this function
     */
    function setGovernor(address _governor) override external onlyGovernor {
        governor = _governor;
        for (uint256 i = 0; i < wrappedTokens.length; i++) {
            GovernedTokenWrapper(wrappedTokens[i]).setGovernor(_governor);
        }
    }

    /**
        @notice Gets the currently available wrappable tokens by their addresses
        @return address[] The currently available wrappable token addresses
     */
    function getWrappedTokens() external view returns (address[] memory) {
        return wrappedTokens;
    }

    /**
        @notice Modifier for enforcing that the caller is the governor
     */
    modifier onlyGovernor() {
        require(msg.sender == governor, "Only governor can call this function");
        _;
    }
}
