/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "./FungibleTokenWrapper.sol";
import "../interfaces/tokens/IAaveTokenWrapper.sol";
import "../interfaces/external/aave/IAaveLendingPool.sol";

/**
    @title An AaveTokenWrapper system that deposits/withdraws into Aave lending pools
    @author Webb Technologies.
 */
contract AaveTokenWrapper is FungibleTokenWrapper, IAaveTokenWrapper {
	IAaveLendingPool public aaveLendingPool;

	/**
        @notice AaveTokenWrapper constructor
        @param _name The name of the ERC20 TokenWrapper
        @param _symbol The symbol of the ERC20 TokenWrapper
     */
	constructor(
		string memory _name,
		string memory _symbol,
		address _aaveLendingPool
	) FungibleTokenWrapper(_name, _symbol) {}

	/**
        @notice AaveTokenWrapper initializer
        @param _feePercentage The fee percentage for wrapping
        @param _feeRecipient The recipient for fees from wrapping.
        @param _handler The address of the handler
        @param _limit The maximum amount of tokens that can be wrapped
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
		@param _admin The address of the admin who will receive minting rights and admin role
		@param _aaveLendingPool The address of the Aave lending pool
     */
	function initialize(
		uint16 _feePercentage,
		address _feeRecipient,
		address _handler,
		uint256 _limit,
		bool _isNativeAllowed,
		address _admin,
		address _aaveLendingPool
	) public onlyUninitialized {
		super.initialize(_feePercentage, _feeRecipient, _handler, _limit, _isNativeAllowed, _admin);
		aaveLendingPool = IAaveLendingPool(_aaveLendingPool);
	}

	/// @inheritdoc IAaveTokenWrapper
	function deposit(address _tokenAddress, uint256 _amount) external override {
		IERC20(_tokenAddress).approve(address(aaveLendingPool), _amount);
		aaveLendingPool.deposit(_tokenAddress, _amount, address(this), 0);
	}

	/// @inheritdoc IAaveTokenWrapper
	function withdraw(address _tokenAddress, uint256 _amount) external override {
		uint256 tokenBalance = IERC20(_tokenAddress).balanceOf(address(this));
		aaveLendingPool.withdraw(_tokenAddress, _amount, address(this));
		uint256 redeemed = IERC20(_tokenAddress).balanceOf(address(this)) - tokenBalance;
		require(redeemed >= _amount, "Invalid withdraw");
	}
}
