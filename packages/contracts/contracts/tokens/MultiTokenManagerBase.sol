/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./GovernedTokenWrapper.sol";
import "./NftTokenWrapper.sol";
import "../interfaces/tokens/IMultiTokenManager.sol";
import "../interfaces/ISetGovernor.sol";

/**
    @title A MultiNftTokenManagerBase
    @author Webb Technologies.
 */
abstract contract MultiTokenManagerBase is IMultiTokenManager, ISetGovernor {
    using SafeMath for uint256;
    address public registry;
    address public governor;
    address public masterFeeRecipient;

    uint256 public proposalNonce = 0;
    address[] public wrappedTokens;

    constructor(
        address _registry,
        address _governor,
        address _feeRecipient
    ) {
        registry = _registry;
        governor = _governor;
        masterFeeRecipient = _feeRecipient;
    }

    /**
        @notice Sets the governor of the MultiTokenManager contract and its children
        @param _governor The address of the new governor
        @notice Only the governor can call this function
     */
    // TODO: Benchmark how many tokens this can set the governor of in a single transaction.
    function setGovernor(address _governor) override external onlyRegistry {
        governor = _governor;
        for (uint256 i = 0; i < wrappedTokens.length; i++) {
            ISetGovernor(wrappedTokens[i]).setGovernor(_governor);
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
    modifier onlyRegistry() {
        require(msg.sender == governor, "Only governor can call this function");
        _;
    }
}
