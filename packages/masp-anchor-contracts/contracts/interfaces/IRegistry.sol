/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

/**
    @title A MultiTokenManager manages FungibleTokenWrapper systems using an external `governor` address
    @author Webb Technologies.
 */
interface IRegistry {
	/**
        @notice Registers a new token and deploys the FungibleTokenWrapper contract
        @param _nonce The nonce of the proposal
        @param _handler The address of the token handler contract
        @param _assetIdentifier The identifier of the asset for the MASP
        @param _name The name of the ERC20
        @param _symbol The symbol of the ERC20
        @param _salt Salt used for matching addresses across chain using CREATE2
        @param _feePercentage The fee percentage for wrapping
        @param _limit The maximum amount of tokens that can be wrapped
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
     */
	function registerToken(
		uint32 _nonce,
		address _handler,
		uint256 _assetIdentifier,
		string memory _name,
		string memory _symbol,
		bytes32 _salt,
		uint256 _limit,
		uint16 _feePercentage,
		bool _isNativeAllowed
	) external;

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
	) external;

	/**
        @notice Fetches the address for an asset ID
        @param _assetId The asset ID
     */
	function getWrappedAssetAddress(uint256 _assetId) external view returns (address);

	/**
        @notice Fetches the asset ID for an address
        @param _address The address
     */
	function getAssetIdFromWrappedAddress(address _address) external view returns (uint256);

	/**
      @notice Fetches the address for an asset ID
      @param _assetId The asset ID
   */
	function getUnwrappedAssetAddress(uint256 _assetId) external view returns (address);

	/**
      @notice Fetches the asset ID for an address
      @param _address The address
   */
	function getAssetIdFromUnwrappedAddress(address _address) external view returns (uint256);
}
