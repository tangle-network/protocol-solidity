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

	event RegistryIsSet(address _registyAddress);
	event MasterFeeRecipientIsSet(address _feeRecipient);

	function initialize(
		address _registry,
		address _feeRecipient
	) external override onlyUninitialized {
		initialized = true;
		require(_registry != address(0), "Registry address can't be 0");
		require(_feeRecipient != address(0), "Fee recipient address can't be 0");
		registry = _registry;
		masterFeeRecipient = _feeRecipient;
	}

	/**
        @notice Sets the registry
     */
	function setRegistry(address _registry) external onlyInitialized {
		require(msg.sender == registry, "MultiTokenManager: Only registry can set registry");
		require(_registry != address(0), "Registry address can't be 0");
		registry = _registry;
		emit RegistryIsSet(registry);
	}

	/**
        @notice Sets the master fee recipient
     */
	function setMasterFeeRecipient(address _feeRecipient) external onlyInitialized {
		require(
			msg.sender == masterFeeRecipient,
			"MultiTokenManager: Only registry can set master fee recipient"
		);
		require(_feeRecipient != address(0), "Fee recipient address can't be 0");
		masterFeeRecipient = _feeRecipient;
		emit MasterFeeRecipientIsSet(masterFeeRecipient);
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
