/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.5;
pragma experimental ABIEncoderV2;

import "../structs/PublicInputs.sol";

/**
    @title MASPVAnchorEncodeInputs library for encoding inputs for MASP VAnchor proofs
 */
library MASPVAnchorEncodeInputs {
	bytes2 public constant EVM_CHAIN_ID_TYPE = 0x0100;

	/**
        @notice Gets the chain id using the chain id opcode
     */
	function getChainId() public view returns (uint) {
		uint chainId;
		assembly {
			chainId := chainid()
		}
		return chainId;
	}

	/**
        @notice Computes the modified chain id using the underlying chain type (EVM)
     */
	function getChainIdType() public view returns (uint48) {
		// The chain ID and type pair is 6 bytes in length
		// The first 2 bytes are reserved for the chain type.
		// The last 4 bytes are reserved for a u32 (uint32) chain ID.
		bytes4 chainID = bytes4(uint32(getChainId()));
		bytes2 chainType = EVM_CHAIN_ID_TYPE;
		// We encode the chain ID and type pair into packed bytes which
		// should be 6 bytes using the encode packed method. We will
		// cast this as a bytes32 in order to encode as a uint256 for zkp verification.
		bytes memory chainIdWithType = abi.encodePacked(chainType, chainID);
		return uint48(bytes6(chainIdWithType));
	}

	/**
        @notice Encodes the proof into its public inputs and roots array for 2 input / 2 output txes
        @param _args The proof arguments
        @param _maxEdges The maximum # of edges supported by the underlying VAnchor
        @return (bytes, bytes) The public inputs and roots array separated
     */
	function _encodeInputs2(
		PublicInputs memory _args,
		bytes memory _auxPublicInputs,
		uint8 _maxEdges
	) public view returns (bytes memory, uint256[] memory) {
		uint256 _chainId = getChainIdType();
		uint256[] memory result = new uint256[](_maxEdges + 1);
		bytes memory encodedInput;

		AuxPublicInputs memory _aux = abi.decode(_auxPublicInputs, (AuxPublicInputs));

		if (_maxEdges == 1) {
			uint256[10] memory inputs;
			uint256[2] memory roots = abi.decode(_args.roots, (uint256[2]));
			// assign roots
			result[0] = roots[0];
			result[1] = roots[1];
			// assign input
			inputs[0] = uint256(_args.publicAmount);
			inputs[1] = uint256(_args.extDataHash);
			inputs[2] = uint256(_aux.assetID);
			inputs[3] = uint256(_args.inputNullifiers[0]);
			inputs[4] = uint256(_args.inputNullifiers[1]);
			inputs[5] = uint256(_args.outputCommitments[0]);
			inputs[6] = uint256(_args.outputCommitments[1]);
			inputs[7] = uint256(_chainId);
			inputs[8] = uint256(roots[0]);
			inputs[9] = uint256(roots[1]);
			encodedInput = abi.encodePacked(inputs);
		} else if (_maxEdges == 7) {
			uint256[16] memory inputs;
			uint256[8] memory roots = abi.decode(_args.roots, (uint256[8]));
			// assign roots
			result[0] = roots[0];
			result[1] = roots[1];
			result[2] = roots[2];
			result[3] = roots[3];
			result[4] = roots[4];
			result[5] = roots[5];
			result[6] = roots[6];
			result[7] = roots[7];
			// assign input
			inputs[0] = uint256(_args.publicAmount);
			inputs[1] = uint256(_args.extDataHash);
			inputs[2] = uint256(_aux.assetID);
			inputs[3] = uint256(_args.inputNullifiers[0]);
			inputs[4] = uint256(_args.inputNullifiers[1]);
			inputs[5] = uint256(_args.outputCommitments[0]);
			inputs[6] = uint256(_args.outputCommitments[1]);
			inputs[7] = uint256(_chainId);
			inputs[8] = uint256(roots[0]);
			inputs[9] = uint256(roots[1]);
			inputs[10] = uint256(roots[2]);
			inputs[11] = uint256(roots[3]);
			inputs[12] = uint256(roots[4]);
			inputs[13] = uint256(roots[5]);
			inputs[14] = uint256(roots[6]);
			inputs[15] = uint256(roots[7]);
			encodedInput = abi.encodePacked(inputs);
		} else {
			require(false, "Invalid edges");
		}

		return (encodedInput, result);
	}

	/**
        @notice Encodes the proof into its public inputs and roots array for 16 input / 2 output txes
        @param _args The proof arguments
        @param _maxEdges The maximum # of edges supported by the underlying VAnchor
        @return (bytes, bytes) The public inputs and roots array separated
     */
	function _encodeInputs16(
		PublicInputs memory _args,
		bytes memory _auxPublicInputs,
		uint8 _maxEdges
	) public view returns (bytes memory, uint256[] memory) {
		uint256 _chainId = getChainIdType();
		uint256[] memory result = new uint256[](_maxEdges + 1);
		bytes memory encodedInput;

		AuxPublicInputs memory _aux = abi.decode(_auxPublicInputs, (AuxPublicInputs));

		if (_maxEdges == 1) {
			uint256[24] memory inputs;
			uint256[2] memory roots = abi.decode(_args.roots, (uint256[2]));
			// assign roots
			result[0] = roots[0];
			result[1] = roots[1];
			// assign input
			//encodedInput = abi.encodePacked(inputs);
			inputs[0] = uint256(_args.publicAmount);
			inputs[1] = uint256(_args.extDataHash);
			inputs[2] = uint256(_aux.assetID);
			inputs[3] = uint256(_args.inputNullifiers[0]);
			inputs[4] = uint256(_args.inputNullifiers[1]);
			inputs[5] = uint256(_args.inputNullifiers[2]);
			inputs[6] = uint256(_args.inputNullifiers[3]);
			inputs[7] = uint256(_args.inputNullifiers[4]);
			inputs[8] = uint256(_args.inputNullifiers[5]);
			inputs[9] = uint256(_args.inputNullifiers[6]);
			inputs[10] = uint256(_args.inputNullifiers[7]);
			inputs[11] = uint256(_args.inputNullifiers[8]);
			inputs[12] = uint256(_args.inputNullifiers[9]);
			inputs[13] = uint256(_args.inputNullifiers[10]);
			inputs[14] = uint256(_args.inputNullifiers[11]);
			inputs[15] = uint256(_args.inputNullifiers[12]);
			inputs[16] = uint256(_args.inputNullifiers[13]);
			inputs[17] = uint256(_args.inputNullifiers[14]);
			inputs[18] = uint256(_args.inputNullifiers[15]);
			inputs[19] = uint256(_args.outputCommitments[0]);
			inputs[20] = uint256(_args.outputCommitments[1]);
			inputs[21] = uint256(_chainId);
			inputs[22] = uint256(roots[0]);
			inputs[23] = uint256(roots[1]);
			encodedInput = abi.encodePacked(inputs);
		} else if (_maxEdges == 7) {
			uint256[30] memory inputs;
			uint256[8] memory roots = abi.decode(_args.roots, (uint256[8]));
			// assign roots
			result[0] = roots[0];
			result[1] = roots[1];
			result[2] = roots[2];
			result[3] = roots[3];
			result[4] = roots[4];
			result[5] = roots[5];
			result[6] = roots[6];
			result[7] = roots[7];
			// assign input
			inputs[0] = uint256(_args.publicAmount);
			inputs[1] = uint256(_args.extDataHash);
			inputs[2] = uint256(_aux.assetID);
			inputs[3] = uint256(_args.inputNullifiers[0]);
			inputs[4] = uint256(_args.inputNullifiers[1]);
			inputs[5] = uint256(_args.inputNullifiers[2]);
			inputs[6] = uint256(_args.inputNullifiers[3]);
			inputs[7] = uint256(_args.inputNullifiers[4]);
			inputs[8] = uint256(_args.inputNullifiers[5]);
			inputs[9] = uint256(_args.inputNullifiers[6]);
			inputs[10] = uint256(_args.inputNullifiers[7]);
			inputs[11] = uint256(_args.inputNullifiers[8]);
			inputs[12] = uint256(_args.inputNullifiers[9]);
			inputs[13] = uint256(_args.inputNullifiers[10]);
			inputs[14] = uint256(_args.inputNullifiers[11]);
			inputs[15] = uint256(_args.inputNullifiers[12]);
			inputs[16] = uint256(_args.inputNullifiers[13]);
			inputs[17] = uint256(_args.inputNullifiers[14]);
			inputs[18] = uint256(_args.inputNullifiers[15]);
			inputs[19] = uint256(_args.outputCommitments[0]);
			inputs[20] = uint256(_args.outputCommitments[1]);
			inputs[21] = uint256(_chainId);
			inputs[22] = uint256(roots[0]);
			inputs[23] = uint256(roots[1]);
			inputs[24] = uint256(roots[2]);
			inputs[25] = uint256(roots[3]);
			inputs[26] = uint256(roots[4]);
			inputs[27] = uint256(roots[5]);
			inputs[28] = uint256(roots[6]);
			inputs[29] = uint256(roots[7]);
			encodedInput = abi.encodePacked(inputs);
		} else {
			require(false, "Invalid edges");
		}

		return (encodedInput, result);
	}
}
