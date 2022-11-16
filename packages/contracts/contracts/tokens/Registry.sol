/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./FungibleTokenWrapper.sol";
import "./Initialized.sol";
import "./NftTokenWrapper.sol";
import "../interfaces/tokens/IRegistry.sol";
import "../interfaces/tokens/IMultiTokenManager.sol";

/**
    @title A Registry for registering different assets
    ERC20 / ERC721 / ERC1155 tokens on the bridge
    @author Webb Technologies.
 */
contract Registry is Initialized, IRegistry {
    using SafeMath for uint256;

    address public fungibleTokenManager;
    address public nonFungibleTokenManager;

    address public registryHandler;
    address public masterFeeRecipient;
    address public maspVAnchor;

    uint256 public proposalNonce = 0;

    // TODO: Maintain a map from wrapped tokens (fungible + NFTs) to assetIDs
	// TODO: Start assetIDs at 1, use 0 to indicate an invalid bridge ERC20 (non-existant)
	mapping (address => uint256) public wrappedAssetToId;
	mapping (uint256 => address) public idToWrappedAsset;

    event TokenRegistered(
        address indexed token,
        address indexed handler,
        uint256 indexed assetId
    );

    constructor() {
        registryHandler = msg.sender;
        masterFeeRecipient = msg.sender;
    }

    function initialize(
        address _fungibleTokenManager,
        address _nonFungibleTokenManager,
        address _handler,
        address _masterFeeRecipient,
        address _maspVAnchor
    ) external onlyHandler onlyUninitialized {
        initialized = true;
        fungibleTokenManager = _fungibleTokenManager;
        nonFungibleTokenManager = _nonFungibleTokenManager;
        registryHandler = _handler;
        masterFeeRecipient = _masterFeeRecipient;
        maspVAnchor = _maspVAnchor;
    }

    /**
        @notice Registers a new token and deploys the FungibleTokenWrapper contract
        @param _nonce The nonce of the proposal
        @param _tokenHandler The address of the token handler contract
        @param _assetIdentifier The identifier of the asset for the MASP
        @param _name The name of the ERC20
        @param _symbol The symbol of the ERC20
        @param _limit The maximum amount of tokens that can be wrapped
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
        @param _salt Salt used for matching addresses across chain using CREATE2
     */
    function registerToken(
        uint32 _nonce,
        address _tokenHandler,
        uint256 _assetIdentifier,
        bytes32 _name,
        bytes32 _symbol,
        bytes32 _salt,
        uint256 _limit,
        bool _isNativeAllowed
    ) override external onlyHandler onlyInitialized {
        require(idToWrappedAsset[_assetIdentifier] == address(0x0), "Registry: Asset already registered");
        require(proposalNonce < _nonce, "Registry: Invalid nonce");
        require(_nonce < proposalNonce + 1, "Registry: Nonce must not increment more than 1048");
        proposalNonce = _nonce;
        address token = IMultiTokenManager(fungibleTokenManager)
            .registerToken(
                _tokenHandler,
                string(abi.encodePacked(_name)),
                string(abi.encodePacked(_symbol)),
                _salt,
                _limit,
                _isNativeAllowed
            );
        emit TokenRegistered(token, _tokenHandler, _assetIdentifier);
        idToWrappedAsset[_assetIdentifier] = token;
        wrappedAssetToId[token] = _assetIdentifier;
    }

    /**
        @notice Registers a new NFT token and deploys the NftTokenWrapper contract
        @param _nonce The nonce of the proposal
        @param _tokenHandler The address of the token handler contract
        @param _assetIdentifier The identifier of the asset for the MASP
        @param _uri The uri for the wrapped NFT
        @param _salt Salt used for matching addresses across chain using CREATE2
     */
    function registerNftToken(
        uint32 _nonce,
        address _tokenHandler,
        uint256 _assetIdentifier,
        bytes memory _uri,
        bytes32 _salt
    ) override external onlyHandler onlyInitialized {
        require(idToWrappedAsset[_assetIdentifier] == address(0x0), "Registry: Asset already registered");
        require(proposalNonce < _nonce, "Registry: Invalid nonce");
        require(_nonce < proposalNonce + 1, "Registry: Nonce must not increment more than 1048");
        proposalNonce = _nonce;
        address token = IMultiTokenManager(nonFungibleTokenManager)
            .registerNftToken(
                _tokenHandler,
                string(abi.encodePacked(_uri)),
                _salt
            );
        emit TokenRegistered(token, _tokenHandler, _assetIdentifier);
        idToWrappedAsset[_assetIdentifier] = token;
        wrappedAssetToId[token] = _assetIdentifier;
    }

    /**
        @notice Fetches the address for an asset ID
        @param _assetId The asset ID
     */
    function getAssetAddress(uint256 _assetId) override external view returns (address) {
        return idToWrappedAsset[_assetId];
    }

    /**
        @notice Fetches the asset ID for an address
        @param _address The address
     */
    function getAssetId(address _address) override external view returns (uint256) {
        return wrappedAssetToId[_address];
    }

    /**
        @notice Modifier for enforcing that the caller is the governor
     */
    modifier onlyHandler() {
        require(msg.sender == registryHandler, "Only governor can call this function");
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
