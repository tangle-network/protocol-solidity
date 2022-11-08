/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./GovernedTokenWrapper.sol";
import "./Initialized.sol";
import "./NftTokenWrapper.sol";
import "../interfaces/tokens/IMultiTokenManager.sol";

/**
    @title A MultiNftTokenManager manages NftTokenWrapper systems using an external `governor` address
    @author Webb Technologies.
 */
contract Registrar is Initialized, IMultiTokenManager {
    using SafeMath for uint256;

    address public governor;
    address public masterFeeRecipient;
    IMultiTokenManager public fungibleTokenManager;
    IMultiTokenManager public nonFungibleTokenManager;

    uint256 public proposalNonce = 0;
    address[] public wrappedTokens;

    constructor() {
        governor = msg.sender;
        masterFeeRecipient = msg.sender;
    }

    function initialize(
        IMultiTokenManager _fungibleTokenManager,
        IMultiTokenManager _nonFungibleTokenManager
    ) external onlyGovernor onlyUninitialized {
        initialized = true;
        fungibleTokenManager = _fungibleTokenManager;
        nonFungibleTokenManager = _nonFungibleTokenManager;
    }

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
    ) override external onlyGovernor onlyInitialized returns (address) {
        return IMultiTokenManager(fungibleTokenManager)
            .registerToken(
                _name,
                _symbol,
                _salt,
                _limit,
                _isNativeAllowed
            );
    }

    /**
        Registers an NFT token
     */
    function registerNFTToken(
        string memory _uri,
        bytes32 _salt
    ) override external onlyGovernor onlyInitialized returns (address) {
        return IMultiTokenManager(nonFungibleTokenManager)
            .registerNFTToken(
                _uri,
                _salt
            );
    }

    /**
        @notice Sets the governor of the MultiTokenManager contract
        @param _governor The address of the new governor
        @notice Only the governor can call this function
     */
    function setGovernor(address _governor) onlyInitialized override external onlyGovernor {
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
