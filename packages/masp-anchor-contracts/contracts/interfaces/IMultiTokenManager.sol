/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

/**
    @title A MultiTokenManager manages FungibleTokenWrapper systems using an external `governor` address
    @author Webb Technologies.
 */
interface IMultiTokenManager {
	/**
        @notice Initialize the contract with the registry and fee recipient
        @param _registry The address of the registry
        @param _feeRecipient The address of the fee recipient
     */
	function initialize(address _registry, address _feeRecipient) external;

	/**
        @notice Registers a new token and deploys the FungibleTokenWrapper contract
        @param _handler The address of the token handler contract
        @param _name The name of the ERC20
        @param _symbol The symbol of the ERC20
        @param _salt Salt used for matching addresses across chain using CREATE2
        @param _limit The maximum amount of tokens that can be wrapped
        @param _feePercentage The fee percentage for wrapping
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
        @param _admin The address of the admin who will receive minting rights and admin role
     */
	function registerToken(
		address _handler,
		string memory _name,
		string memory _symbol,
		bytes32 _salt,
		uint256 _limit,
		uint16 _feePercentage,
		bool _isNativeAllowed,
		address _admin
	) external returns (address);

	/**
        @notice Registers a new NFT token and deploys the NftTokenWrapper contract
        @param _handler The address of the token handler contract
        @param _unwrappedNftAddress The address of the unwrapped NFT
         @param _name The name of the ERC721
         @param _symbol The symbol of the ERC721
        @param _salt Salt used for matching addresses across chain using CREATE2
     */
	function registerNftToken(
		address _handler,
		address _unwrappedNftAddress,
		string memory _name,
		string memory _symbol,
		bytes32 _salt
	) external returns (address);
}
