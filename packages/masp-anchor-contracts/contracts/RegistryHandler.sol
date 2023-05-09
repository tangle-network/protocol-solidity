/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;
pragma experimental ABIEncoderV2;

import "@webb-tools/protocol-solidity/handlers/HandlerHelpers.sol";
import "@webb-tools/protocol-solidity/interfaces/IExecutor.sol";
import "./interfaces/IRegistry.sol";

/**
    @title Handles Registry token registrations for ERC20 and NFT tokens
    @author Webb Technologies.
    @notice This contract is intended to be used with the Bridge and SignatureBridge contracts.
 */
contract RegistryHandler is IExecutor, HandlerHelpers {
	/**
        @param bridgeAddress Contract address of previously deployed Bridge.
        @param initialResourceIDs Resource IDs are used to identify a specific contract address.
        These are the Resource IDs this contract will initially support.
        @param initialContractAddresses These are the addresses the {initialResourceIDs} will point to, and are the contracts that will be
        called to perform various deposit calls.
        @dev {initialResourceIDs} and {initialContractAddresses} must have the same length (one resourceID for every address).
        Also, these arrays must be ordered in the way that {initialResourceIDs}[0] is the intended resourceID for {initialContractAddresses}[0].
     */
	constructor(
		address bridgeAddress,
		bytes32[] memory initialResourceIDs,
		address[] memory initialContractAddresses
	) {
		require(
			initialResourceIDs.length == initialContractAddresses.length,
			"initialResourceIDs and initialContractAddresses len mismatch"
		);

		_bridgeAddress = bridgeAddress;

		for (uint256 i = 0; i < initialResourceIDs.length; i++) {
			_setResource(initialResourceIDs[i], initialContractAddresses[i]);
		}
	}

	/**
        @notice Proposal execution should be initiated when a proposal is finalized in the Bridge contract.
        by a relayer on the deposit's destination chain. Or when a valid signature is produced by the DKG in the case of SignatureBridge.
        @param resourceID ResourceID corresponding to a particular set of FungibleTokenWrapper contracts
        @param data Consists of a specific proposal data structure for each finer-grained token wrapper proposal
     */
	function executeProposal(bytes32 resourceID, bytes calldata data) external override onlyBridge {
		bytes32 resourceId;
		bytes4 functionSig;
		bytes calldata arguments;

		resourceId = bytes32(data[0:32]);
		functionSig = bytes4(data[32:36]);
		arguments = data[36:];

		address registryAddress = _resourceIDToContractAddress[resourceID];
		IRegistry registry = IRegistry(registryAddress);

		if (
			functionSig ==
			bytes4(
				keccak256(
					"registerToken(uint32,address,uint256,string,string,bytes32,uint256,uint16,bool)"
				)
			)
		) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			address tokenHandler = address(bytes20(arguments[4:24]));
			uint256 assetId = uint256(bytes32(arguments[24:56]));
			bytes32 name = bytes32(arguments[56:88]);
			bytes32 symbol = bytes32(arguments[88:120]);
			bytes32 salt = bytes32(arguments[120:152]);
			uint256 limit = uint256(bytes32(arguments[152:184]));
			uint16 feePercentage = uint16(bytes2(arguments[184:186]));
			bool isNativeAllowed = bytes1(arguments[186:187]) == 0x01;
			registry.registerToken(
				nonce,
				tokenHandler,
				assetId,
				bytes32ToString(name),
				bytes32ToString(symbol),
				salt,
				limit,
				feePercentage,
				isNativeAllowed
			);
		} else if (
			functionSig ==
			bytes4(
				keccak256("registerNftToken(uint32,address,uint256,address,string,string,bytes32)")
			)
		) {
			uint32 nonce = uint32(bytes4(arguments[0:4]));
			address tokenHandler = address(bytes20(arguments[4:24]));
			uint256 assetId = uint256(bytes32(arguments[24:56]));
			address unwrappedNftAddress = address(bytes20(arguments[56:76]));
			bytes32 salt = bytes32(arguments[76:108]);
			bytes memory name = bytes(arguments[108:140]);
			bytes memory symbol = bytes(arguments[140:172]);
			registry.registerNftToken(
				nonce,
				tokenHandler,
				assetId,
				unwrappedNftAddress,
				string(name),
				string(symbol),
				salt
			);
		} else {
			revert("Invalid function sig");
		}
	}

	function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
		uint8 i = 0;
		while (i < 32 && _bytes32[i] != 0) {
			i++;
		}
		bytes memory bytesArray = new bytes(i);
		for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
			bytesArray[i] = _bytes32[i];
		}
		return string(bytesArray);
	}
}
