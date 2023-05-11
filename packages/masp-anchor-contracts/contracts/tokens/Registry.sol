/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

import "@webb-tools/protocol-solidity/tokens/FungibleTokenWrapper.sol";
import "@webb-tools/protocol-solidity/utils/Initialized.sol";
import "@webb-tools/protocol-solidity/utils/ProposalNonceTracker.sol";
import "./NftTokenWrapper.sol";
import "../interfaces/IRegistry.sol";
import "../interfaces/IMultiTokenManager.sol";

/**
    @title A Registry for registering different assets
    ERC20 / ERC721 / ERC1155 tokens on the bridge
    @author Webb Technologies.
 */
contract Registry is Initialized, IRegistry, ProposalNonceTracker {
	address public fungibleTokenManager;
	address public nonFungibleTokenManager;

	address public registryHandler;
	address public masterFeeRecipient;
	address public maspVAnchor;

	mapping(address => uint256) public wrappedAssetToId;
	mapping(uint256 => address) public idToWrappedAsset;

	mapping(address => uint256) public unwrappedNftAssetToId;
	mapping(uint256 => address) public idToUnwrappedNftAsset;

	event TokenRegistered(address indexed token, address indexed handler, uint256 indexed assetId);

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
	) external onlyUninitialized {
		initialized = true;
		fungibleTokenManager = _fungibleTokenManager;
		nonFungibleTokenManager = _nonFungibleTokenManager;
		registryHandler = _handler;
		masterFeeRecipient = _masterFeeRecipient;
		maspVAnchor = _maspVAnchor;

		IMultiTokenManager(_fungibleTokenManager).initialize(address(this), _masterFeeRecipient);
		IMultiTokenManager(_nonFungibleTokenManager).initialize(address(this), _masterFeeRecipient);
	}

	/**
        @notice Registers a new token and deploys the FungibleTokenWrapper contract
        @param _nonce The nonce of the proposal
        @param _tokenHandler The address of the token handler contract
        @param _assetIdentifier The identifier of the asset for the MASP
        @param _name The name of the ERC20
        @param _symbol The symbol of the ERC20
        @param _salt Salt used for matching addresses across chain using CREATE2
        @param _limit The maximum amount of tokens that can be wrapped
        @param _feePercentage The fee percentage for wrapping
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
     */
	function registerToken(
		uint32 _nonce,
		address _tokenHandler,
		uint256 _assetIdentifier,
		string memory _name,
		string memory _symbol,
		bytes32 _salt,
		uint256 _limit,
		uint16 _feePercentage,
		bool _isNativeAllowed
	) external override onlyHandler onlyInitialized onlyIncrementingByOne(_nonce) {
		require(_assetIdentifier != 0, "Registry: Asset identifier cannot be 0");
		require(
			idToWrappedAsset[_assetIdentifier] == address(0x0),
			"Registry: Asset already registered"
		);
		address token = IMultiTokenManager(fungibleTokenManager).registerToken(
			_tokenHandler,
			_name,
			_symbol,
			_salt,
			_limit,
			_feePercentage,
			_isNativeAllowed,
			maspVAnchor
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
		@param _unwrappedNftAddress Address of the underlying NFT collection
        @param _salt Salt used for matching addresses across chain using CREATE2
     */
	function registerNftToken(
		uint32 _nonce,
		address _tokenHandler,
		uint256 _assetIdentifier,
		address _unwrappedNftAddress,
		string memory _name,
		string memory _symbol,
		bytes32 _salt
	) external override onlyHandler onlyInitialized onlyIncrementingByOne(_nonce) {
		require(_assetIdentifier != 0, "Registry: Asset identifier cannot be 0");
		require(
			idToWrappedAsset[_assetIdentifier] == address(0x0),
			"Registry: Asset already registered"
		);
		address token = IMultiTokenManager(nonFungibleTokenManager).registerNftToken(
			_tokenHandler,
			_unwrappedNftAddress,
			_name,
			_symbol,
			_salt
		);
		emit TokenRegistered(token, _tokenHandler, _assetIdentifier);
		idToWrappedAsset[_assetIdentifier] = token;
		wrappedAssetToId[token] = _assetIdentifier;
		idToUnwrappedNftAsset[_assetIdentifier] = _unwrappedNftAddress;
		unwrappedNftAssetToId[_unwrappedNftAddress] = _assetIdentifier;
	}

	/**
        @notice Fetches the address for an asset ID
        @param _assetId The asset ID
     */
	function getWrappedAssetAddress(uint256 _assetId) external view override returns (address) {
		return idToWrappedAsset[_assetId];
	}

	/**
        @notice Fetches the asset ID for an address
        @param _address The address
     */
	function getAssetIdFromWrappedAddress(
		address _address
	) external view override returns (uint256) {
		return wrappedAssetToId[_address];
	}

	/**
        @notice Fetches the address for an asset ID
        @param _assetId The asset ID
     */
	function getUnwrappedAssetAddress(uint256 _assetId) external view override returns (address) {
		return idToUnwrappedNftAsset[_assetId];
	}

	/**
        @notice Fetches the asset ID for an address
        @param _address The address
     */
	function getAssetIdFromUnwrappedAddress(
		address _address
	) external view override returns (uint256) {
		return unwrappedNftAssetToId[_address];
	}

	/**
        @notice Modifier for enforcing that the caller is the governor
     */
	modifier onlyHandler() {
		require(msg.sender == registryHandler, "Only registry handler can call this function");
		_;
	}
}
