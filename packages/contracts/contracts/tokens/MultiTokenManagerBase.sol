/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.5;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../utils/Initialized.sol";
import "../utils/ProposalNonceTracker.sol";
import "../interfaces/tokens/IMultiTokenManager.sol";

/**
    @title A MultiNftTokenManagerBase
    @author Webb Technologies.
 */
abstract contract MultiTokenManagerBase is IMultiTokenManager, Initialized, ProposalNonceTracker {
	using SafeMath for uint256;
	address public registry;
	address public masterFeeRecipient;
	address[] public wrappedTokens;

	function initialize(
		address _registry,
		address _feeRecipient
	) external override onlyUninitialized {
		initialized = true;
		registry = _registry;
		masterFeeRecipient = _feeRecipient;
	}

	/**
        @notice Sets the registry
     */
	function setRegistry(address _registry) external onlyInitialized {
		require(msg.sender == registry, "MultiTokenManager: Only registry can set registry");
		registry = _registry;
	}

	/**
        @notice Sets the master fee recipient
     */
	function setMasterFeeRecipient(address _feeRecipient) external onlyInitialized {
		require(
			msg.sender == masterFeeRecipient,
			"MultiTokenManager: Only registry can set master fee recipient"
		);
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
        @notice A flag used to separate between fungible and non-fungible token managers
     */
	function isFungible() public virtual returns (bool);

	/**
        @notice Modifier for enforcing that the caller is the governor
     */
	modifier onlyRegistry() {
		require(
			msg.sender == registry,
			"MultiTokenManagerBase: Only registry can call this function"
		);
		_;
	}
}
