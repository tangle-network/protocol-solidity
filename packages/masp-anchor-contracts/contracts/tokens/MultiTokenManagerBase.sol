/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "@webb-tools/protocol-solidity/utils/Initialized.sol";
import "@webb-tools/protocol-solidity/utils/ProposalNonceTracker.sol";
import "../interfaces/IMultiTokenManager.sol";

/**
    @title A MultiNftTokenManagerBase
    @author Webb Technologies.
 */
abstract contract MultiTokenManagerBase is IMultiTokenManager, Initialized, ProposalNonceTracker {
	address public registry;
	address public masterFeeRecipient;
	address[] public wrappedTokens;

	event RegistryUpdated(address _registyAddress);
	event MasterFeeRecipientUpdated(address _feeRecipient);

	function initialize(
		address _registry,
		address _feeRecipient
	) external override onlyUninitialized {
		initialized = true;
		require(_registry != address(0), "MultiTokenManager: Registry address can't be 0");
		require(_feeRecipient != address(0), "MultiTokenManager: Fee recipient address can't be 0");
		registry = _registry;
		masterFeeRecipient = _feeRecipient;
	}

	/**
        @notice Sets the registry
     */
	function setRegistry(address _registry) external onlyInitialized {
		require(msg.sender == registry, "MultiTokenManager: Only registry can set registry");
		require(_registry != address(0), "MultiTokenManager: Registry address can't be 0");
		registry = _registry;
		emit RegistryUpdated(registry);
	}

	/**
        @notice Sets the master fee recipient
     */
	function setMasterFeeRecipient(address _feeRecipient) external onlyInitialized {
		require(
			msg.sender == masterFeeRecipient,
			"MultiTokenManager: Only registry can set master fee recipient"
		);
		require(_feeRecipient != address(0), "MultiTokenManager: Fee recipient address can't be 0");
		masterFeeRecipient = _feeRecipient;
		emit MasterFeeRecipientUpdated(masterFeeRecipient);
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
