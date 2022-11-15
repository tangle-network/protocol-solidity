/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../interfaces/tokens/IMultiTokenManager.sol";

/**
    @title A MultiNftTokenManagerBase
    @author Webb Technologies.
 */
abstract contract MultiTokenManagerBase is IMultiTokenManager {
    using SafeMath for uint256;
    address public registry;
    address public masterFeeRecipient;

    uint256 public proposalNonce = 0;
    address[] public wrappedTokens;

    constructor(
        address _registry,
        address _feeRecipient
    ) {
        registry = _registry;
        masterFeeRecipient = _feeRecipient;
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
        require(msg.sender == registry, "Only registry can call this function");
        _;
    }
}
