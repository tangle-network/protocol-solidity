/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./GovernedTokenWrapper.sol";
import "./Initialized.sol";
import "./NftTokenWrapper.sol";
import "../interfaces/tokens/IRegistry.sol";
import "../interfaces/tokens/IMultiTokenManager.sol";
import "../interfaces/ISetGovernor.sol";

/**
    @title A Registry for registering different assets
    ERC20 / ERC721 / ERC1155 tokens on the bridge
    @author Webb Technologies.
 */
contract Registry is Initialized, IRegistry, ISetGovernor {
    using SafeMath for uint256;

    address public governor;
    address public masterFeeRecipient;
    address public fungibleTokenManager;
    address public nonFungibleTokenManager;

    uint256 public proposalNonce = 0;

    constructor() {
        governor = msg.sender;
        masterFeeRecipient = msg.sender;
    }

    function initialize(
        address _fungibleTokenManager,
        address _nonFungibleTokenManager
    ) external onlyHandler onlyUninitialized {
        initialized = true;
        fungibleTokenManager = _fungibleTokenManager;
        nonFungibleTokenManager = _nonFungibleTokenManager;
    }

    /**
        @notice Registers a new token and deploys the GovernedTokenWrapper contract
        @param _nonce The nonce of the proposal
        @param _name The name of the ERC20
        @param _symbol The symbol of the ERC20
        @param _limit The maximum amount of tokens that can be wrapped
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
        @param _salt Salt used for matching addresses across chain using CREATE2
     */
    function registerToken(
        uint32 _nonce,
        bytes32 _name,
        bytes32 _symbol,
        bytes32 _salt,
        uint256 _limit,
        bool _isNativeAllowed
    ) override external onlyHandler onlyInitialized {
        require(proposalNonce < _nonce, "Registry: Invalid nonce");
        require(_nonce < proposalNonce + 1, "Registry: Nonce must not increment more than 1048");
        proposalNonce = _nonce;
        address token = IMultiTokenManager(fungibleTokenManager)
            .registerToken(
                string(abi.encodePacked(_name)),
                string(abi.encodePacked(_symbol)),
                _salt,
                _limit,
                _isNativeAllowed
            );
    }

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
    ) override external onlyHandler onlyInitialized {
        require(proposalNonce < _nonce, "Registry: Invalid nonce");
        require(_nonce < proposalNonce + 1, "Registry: Nonce must not increment more than 1048");
        proposalNonce = _nonce;
        address token = IMultiTokenManager(nonFungibleTokenManager)
            .registerNftToken(
                string(abi.encodePacked(_uri)),
                _salt
            );
    }

    /**
        @notice Sets the governor of the MultiTokenManager contract
        @param _governor The address of the new governor
        @notice Only the governor can call this function
     */
    function setGovernor(address _governor) onlyInitialized override external onlyHandler {
        governor = _governor;
        ISetGovernor(fungibleTokenManager).setGovernor(_governor);
        ISetGovernor(nonFungibleTokenManager).setGovernor(_governor);
    }

    /**
        @notice Modifier for enforcing that the caller is the governor
     */
    modifier onlyHandler() {
        require(msg.sender == governor, "Only governor can call this function");
        _;
    }

    function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
}
