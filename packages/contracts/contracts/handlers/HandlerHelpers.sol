/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "../interfaces/IExecutor.sol";

/**
    @title Function used across handler contracts.
    @author Webb Technologies, adapted from ChainSafe Systems.
    @notice This contract is intended to be used with the Bridge contract.
 */
abstract contract HandlerHelpers is IExecutor {
	address public _bridgeAddress;

	// resourceID => token contract address
	mapping(bytes32 => address) public _resourceIDToContractAddress;

	// Execution contract address => resourceID
	mapping(address => bytes32) public _contractAddressToResourceID;

	// Execution contract address => is whitelisted
	mapping(address => bool) public _contractWhitelist;

	modifier onlyBridge() {
		_onlyBridge();
		_;
	}

	function _onlyBridge() private view {
		require(msg.sender == _bridgeAddress, "sender must be bridge contract");
	}

	/**
        @notice First verifies {_resourceIDToContractAddress}[{resourceID}] and
        {_contractAddressToResourceID}[{contractAddress}] are not already set,
        then sets {_resourceIDToContractAddress} with {contractAddress},
        {_contractAddressToResourceID} with {resourceID},
        and {_contractWhitelist} to true for {contractAddress}.
        @param resourceID ResourceID to be used when executing proposals.
        @param contractAddress Address of contract to be called when a proposal is signed and submitted for execution.
     */
	function setResource(bytes32 resourceID, address contractAddress) external override onlyBridge {
		_setResource(resourceID, contractAddress);
	}

	function _setResource(bytes32 resourceID, address contractAddress) internal {
		_resourceIDToContractAddress[resourceID] = contractAddress;
		_contractAddressToResourceID[contractAddress] = resourceID;

		_contractWhitelist[contractAddress] = true;
	}

	function migrateBridge(address newBridge) external override onlyBridge {
		require(newBridge != address(0), "Bridge address can't be 0");
		_bridgeAddress = newBridge;
	}
}
