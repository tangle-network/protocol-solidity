/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../interfaces/tokens/IAaveTokenWrapper.sol";
import "./FungibleTokenWrapper.sol";
import "../interfaces/external/aave/IAaveLendingPool.sol";
import "hardhat/console.sol";

/**
    @title An AaveTokenWrapper system that deposits/withdraws into Aave lending pools
    @author Webb Technologies.
 */
contract AaveTokenWrapper is FungibleTokenWrapper, IAaveTokenWrapper {
	using SafeMath for uint256;
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
	) FungibleTokenWrapper(_name, _symbol) {
		aaveLendingPool = IAaveLendingPool(_aaveLendingPool);
	}

	/**
        @notice AaveTokenWrapper initializer
        @param _feeRecipient The recipient for fees from wrapping
        @param _governor The address of the governor
        @param _limit The maximum amount of tokens that can be wrapped
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
     */
	function initialize(
		address _feeRecipient,
		address _governor,
		uint256 _limit,
		bool _isNativeAllowed,
		address _aaveLendingPool
	) public {
		require(!initialized, "Contract already initialized");
		feeRecipient = payable(_feeRecipient);
		wrappingLimit = _limit;
		isNativeAllowed = _isNativeAllowed;
		initialized = true;
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
