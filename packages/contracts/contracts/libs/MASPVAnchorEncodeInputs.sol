// SPDX-License-Identifier: MIT

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

		MASPAuxPublicInputsSmall memory _aux = abi.decode(_auxPublicInputs, (MASPAuxPublicInputsSmall));

		if (_maxEdges == 1) {
			uint256[33] memory inputs;
			uint256[2] memory roots = abi.decode(_args.roots, (uint256[2]));
			// assign roots
			result[0] = roots[0];
			result[1] = roots[1];
			// assign input
			inputs[0] = uint256(_args.publicAmount);
			inputs[1] = uint256(_args.extDataHash);
			inputs[2] = uint256(_aux.publicAssetID);
			inputs[3] = uint256(_aux.publicTokenID);
			inputs[4] = uint256(_args.inputNullifiers[0]);
			inputs[5] = uint256(_args.inputNullifiers[1]);
			inputs[6] = uint256(_args.outputCommitments[0]);
			inputs[7] = uint256(_args.outputCommitments[1]);
			inputs[8] = uint256(_chainId);
			inputs[9] = uint256(roots[0]);
			inputs[10] = uint256(roots[1]);
			inputs[11] = uint256(_aux.ak_alpha_X[0]);
			inputs[12] = uint256(_aux.ak_alpha_X[1]);
			inputs[13] = uint256(_aux.ak_alpha_Y[0]);
			inputs[14] = uint256(_aux.ak_alpha_Y[1]);
			inputs[15] = uint256(_aux.whitelistedAssetIDs[0]);
			inputs[16] = uint256(_aux.whitelistedAssetIDs[1]);
			inputs[17] = uint256(_aux.whitelistedAssetIDs[2]);
			inputs[18] = uint256(_aux.whitelistedAssetIDs[3]);
			inputs[19] = uint256(_aux.whitelistedAssetIDs[4]);
			inputs[20] = uint256(_aux.whitelistedAssetIDs[5]);
			inputs[21] = uint256(_aux.whitelistedAssetIDs[6]);
			inputs[22] = uint256(_aux.whitelistedAssetIDs[7]);
			inputs[23] = uint256(_aux.whitelistedAssetIDs[8]);
			inputs[24] = uint256(_aux.whitelistedAssetIDs[9]);
			inputs[25] = uint256(_aux.feeInputNullifiers[0]);
			inputs[26] = uint256(_aux.feeInputNullifiers[1]);
			inputs[27] = uint256(_aux.feeOutputCommitments[0]);
			inputs[28] = uint256(_aux.feeOutputCommitments[1]);
			inputs[29] = uint256(_aux.fee_ak_alpha_X[0]);
			inputs[30] = uint256(_aux.fee_ak_alpha_X[1]);
			inputs[31] = uint256(_aux.fee_ak_alpha_Y[0]);
			inputs[32] = uint256(_aux.fee_ak_alpha_Y[1]);
			encodedInput = abi.encodePacked(inputs);
		} else if (_maxEdges == 7) {
			uint256[39] memory inputs;
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
			inputs[2] = uint256(_aux.publicAssetID);
			inputs[3] = uint256(_aux.publicTokenID);
			inputs[4] = uint256(_args.inputNullifiers[0]);
			inputs[5] = uint256(_args.inputNullifiers[1]);
			inputs[6] = uint256(_args.outputCommitments[0]);
			inputs[7] = uint256(_args.outputCommitments[1]);
			inputs[8] = uint256(_chainId);
			inputs[9] = uint256(roots[0]);
			inputs[10] = uint256(roots[1]);
			inputs[11] = uint256(roots[2]);
			inputs[12] = uint256(roots[3]);
			inputs[13] = uint256(roots[4]);
			inputs[14] = uint256(roots[5]);
			inputs[15] = uint256(roots[6]);
			inputs[16] = uint256(roots[7]);
			inputs[17] = uint256(_aux.ak_alpha_X[0]);
			inputs[18] = uint256(_aux.ak_alpha_X[1]);
			inputs[19] = uint256(_aux.ak_alpha_Y[0]);
			inputs[20] = uint256(_aux.ak_alpha_Y[1]);
			inputs[21] = uint256(_aux.whitelistedAssetIDs[0]);
			inputs[22] = uint256(_aux.whitelistedAssetIDs[1]);
			inputs[23] = uint256(_aux.whitelistedAssetIDs[2]);
			inputs[24] = uint256(_aux.whitelistedAssetIDs[3]);
			inputs[25] = uint256(_aux.whitelistedAssetIDs[4]);
			inputs[26] = uint256(_aux.whitelistedAssetIDs[5]);
			inputs[27] = uint256(_aux.whitelistedAssetIDs[6]);
			inputs[28] = uint256(_aux.whitelistedAssetIDs[7]);
			inputs[29] = uint256(_aux.whitelistedAssetIDs[8]);
			inputs[30] = uint256(_aux.whitelistedAssetIDs[9]);
			inputs[31] = uint256(_aux.feeInputNullifiers[0]);
			inputs[32] = uint256(_aux.feeInputNullifiers[1]);
			inputs[33] = uint256(_aux.feeOutputCommitments[0]);
			inputs[34] = uint256(_aux.feeOutputCommitments[1]);
			inputs[35] = uint256(_aux.fee_ak_alpha_X[0]);
			inputs[36] = uint256(_aux.fee_ak_alpha_X[1]);
			inputs[37] = uint256(_aux.fee_ak_alpha_Y[0]);
			inputs[38] = uint256(_aux.fee_ak_alpha_Y[1]);
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

		MASPAuxPublicInputsLarge memory _aux = abi.decode(_auxPublicInputs, (MASPAuxPublicInputsLarge));

		if (_maxEdges == 1) {
			uint256[75] memory inputs;
			uint256[2] memory roots = abi.decode(_args.roots, (uint256[2]));
			// assign roots
			result[0] = roots[0];
			result[1] = roots[1];
			// assign input
			//encodedInput = abi.encodePacked(inputs);
			inputs[0] = uint256(_args.publicAmount);
			inputs[1] = uint256(_args.extDataHash);
			inputs[2] = uint256(_aux.publicAssetID);
			inputs[3] = uint256(_aux.publicTokenID);
			inputs[4] = uint256(_args.inputNullifiers[0]);
			inputs[5] = uint256(_args.inputNullifiers[1]);
			inputs[6] = uint256(_args.inputNullifiers[2]);
			inputs[7] = uint256(_args.inputNullifiers[3]);
			inputs[8] = uint256(_args.inputNullifiers[4]);
			inputs[9] = uint256(_args.inputNullifiers[5]);
			inputs[10] = uint256(_args.inputNullifiers[6]);
			inputs[11] = uint256(_args.inputNullifiers[7]);
			inputs[12] = uint256(_args.inputNullifiers[8]);
			inputs[13] = uint256(_args.inputNullifiers[9]);
			inputs[14] = uint256(_args.inputNullifiers[10]);
			inputs[15] = uint256(_args.inputNullifiers[11]);
			inputs[16] = uint256(_args.inputNullifiers[12]);
			inputs[17] = uint256(_args.inputNullifiers[13]);
			inputs[18] = uint256(_args.inputNullifiers[14]);
			inputs[19] = uint256(_args.inputNullifiers[15]);
			inputs[20] = uint256(_args.outputCommitments[0]);
			inputs[21] = uint256(_args.outputCommitments[1]);
			inputs[22] = uint256(_chainId);
			inputs[23] = uint256(roots[0]);
			inputs[24] = uint256(roots[1]);
			inputs[25] = uint256(_aux.ak_alpha_X[0]);
			inputs[26] = uint256(_aux.ak_alpha_X[1]);
			inputs[27] = uint256(_aux.ak_alpha_X[2]);
			inputs[28] = uint256(_aux.ak_alpha_X[3]);
			inputs[29] = uint256(_aux.ak_alpha_X[4]);
			inputs[30] = uint256(_aux.ak_alpha_X[5]);
			inputs[31] = uint256(_aux.ak_alpha_X[6]);
			inputs[32] = uint256(_aux.ak_alpha_X[7]);
			inputs[33] = uint256(_aux.ak_alpha_X[8]);
			inputs[34] = uint256(_aux.ak_alpha_X[9]);
			inputs[35] = uint256(_aux.ak_alpha_X[10]);
			inputs[36] = uint256(_aux.ak_alpha_X[11]);
			inputs[37] = uint256(_aux.ak_alpha_X[12]);
			inputs[38] = uint256(_aux.ak_alpha_X[13]);
			inputs[39] = uint256(_aux.ak_alpha_X[14]);
			inputs[40] = uint256(_aux.ak_alpha_X[15]);
			inputs[41] = uint256(_aux.ak_alpha_Y[0]);
			inputs[42] = uint256(_aux.ak_alpha_Y[1]);
			inputs[43] = uint256(_aux.ak_alpha_Y[2]);
			inputs[44] = uint256(_aux.ak_alpha_Y[3]);
			inputs[45] = uint256(_aux.ak_alpha_Y[4]);
			inputs[46] = uint256(_aux.ak_alpha_Y[5]);
			inputs[47] = uint256(_aux.ak_alpha_Y[6]);
			inputs[48] = uint256(_aux.ak_alpha_Y[7]);
			inputs[49] = uint256(_aux.ak_alpha_Y[8]);
			inputs[50] = uint256(_aux.ak_alpha_Y[9]);
			inputs[51] = uint256(_aux.ak_alpha_Y[10]);
			inputs[52] = uint256(_aux.ak_alpha_Y[11]);
			inputs[53] = uint256(_aux.ak_alpha_Y[12]);
			inputs[54] = uint256(_aux.ak_alpha_Y[13]);
			inputs[55] = uint256(_aux.ak_alpha_Y[14]);
			inputs[56] = uint256(_aux.ak_alpha_Y[15]);
			inputs[57] = uint256(_aux.whitelistedAssetIDs[0]);
			inputs[58] = uint256(_aux.whitelistedAssetIDs[1]);
			inputs[59] = uint256(_aux.whitelistedAssetIDs[2]);
			inputs[60] = uint256(_aux.whitelistedAssetIDs[3]);
			inputs[61] = uint256(_aux.whitelistedAssetIDs[4]);
			inputs[62] = uint256(_aux.whitelistedAssetIDs[5]);
			inputs[63] = uint256(_aux.whitelistedAssetIDs[6]);
			inputs[64] = uint256(_aux.whitelistedAssetIDs[7]);
			inputs[65] = uint256(_aux.whitelistedAssetIDs[8]);
			inputs[66] = uint256(_aux.whitelistedAssetIDs[9]);
			inputs[67] = uint256(_aux.feeInputNullifiers[0]);
			inputs[68] = uint256(_aux.feeInputNullifiers[1]);
			inputs[69] = uint256(_aux.feeOutputCommitments[0]);
			inputs[70] = uint256(_aux.feeOutputCommitments[1]);
			inputs[71] = uint256(_aux.fee_ak_alpha_X[0]);
			inputs[72] = uint256(_aux.fee_ak_alpha_X[1]);
			inputs[73] = uint256(_aux.fee_ak_alpha_Y[0]);
			inputs[74] = uint256(_aux.fee_ak_alpha_Y[1]);
			encodedInput = abi.encodePacked(inputs);
		} else if (_maxEdges == 7) {
			uint256[81] memory inputs;
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
			inputs[2] = uint256(_aux.publicAssetID);
			inputs[3] = uint256(_aux.publicTokenID);
			inputs[4] = uint256(_args.inputNullifiers[0]);
			inputs[5] = uint256(_args.inputNullifiers[1]);
			inputs[6] = uint256(_args.inputNullifiers[2]);
			inputs[7] = uint256(_args.inputNullifiers[3]);
			inputs[8] = uint256(_args.inputNullifiers[4]);
			inputs[9] = uint256(_args.inputNullifiers[5]);
			inputs[10] = uint256(_args.inputNullifiers[6]);
			inputs[11] = uint256(_args.inputNullifiers[7]);
			inputs[12] = uint256(_args.inputNullifiers[8]);
			inputs[13] = uint256(_args.inputNullifiers[9]);
			inputs[14] = uint256(_args.inputNullifiers[10]);
			inputs[15] = uint256(_args.inputNullifiers[11]);
			inputs[16] = uint256(_args.inputNullifiers[12]);
			inputs[17] = uint256(_args.inputNullifiers[13]);
			inputs[18] = uint256(_args.inputNullifiers[14]);
			inputs[19] = uint256(_args.inputNullifiers[15]);
			inputs[20] = uint256(_args.outputCommitments[0]);
			inputs[21] = uint256(_args.outputCommitments[1]);
			inputs[22] = uint256(_chainId);
			inputs[23] = uint256(roots[0]);
			inputs[24] = uint256(roots[1]);
			inputs[25] = uint256(roots[2]);
			inputs[26] = uint256(roots[3]);
			inputs[27] = uint256(roots[4]);
			inputs[28] = uint256(roots[5]);
			inputs[29] = uint256(roots[6]);
			inputs[30] = uint256(roots[7]);
			inputs[31] = uint256(_aux.ak_alpha_X[0]);
			inputs[32] = uint256(_aux.ak_alpha_X[1]);
			inputs[33] = uint256(_aux.ak_alpha_X[2]);
			inputs[34] = uint256(_aux.ak_alpha_X[3]);
			inputs[35] = uint256(_aux.ak_alpha_X[4]);
			inputs[36] = uint256(_aux.ak_alpha_X[5]);
			inputs[37] = uint256(_aux.ak_alpha_X[6]);
			inputs[38] = uint256(_aux.ak_alpha_X[7]);
			inputs[39] = uint256(_aux.ak_alpha_X[8]);
			inputs[40] = uint256(_aux.ak_alpha_X[9]);
			inputs[41] = uint256(_aux.ak_alpha_X[10]);
			inputs[42] = uint256(_aux.ak_alpha_X[11]);
			inputs[43] = uint256(_aux.ak_alpha_X[12]);
			inputs[44] = uint256(_aux.ak_alpha_X[13]);
			inputs[45] = uint256(_aux.ak_alpha_X[14]);
			inputs[46] = uint256(_aux.ak_alpha_X[15]);
			inputs[47] = uint256(_aux.ak_alpha_Y[0]);
			inputs[48] = uint256(_aux.ak_alpha_Y[1]);
			inputs[49] = uint256(_aux.ak_alpha_Y[2]);
			inputs[50] = uint256(_aux.ak_alpha_Y[3]);
			inputs[51] = uint256(_aux.ak_alpha_Y[4]);
			inputs[52] = uint256(_aux.ak_alpha_Y[5]);
			inputs[53] = uint256(_aux.ak_alpha_Y[6]);
			inputs[54] = uint256(_aux.ak_alpha_Y[7]);
			inputs[55] = uint256(_aux.ak_alpha_Y[8]);
			inputs[56] = uint256(_aux.ak_alpha_Y[9]);
			inputs[57] = uint256(_aux.ak_alpha_Y[10]);
			inputs[58] = uint256(_aux.ak_alpha_Y[11]);
			inputs[59] = uint256(_aux.ak_alpha_Y[12]);
			inputs[60] = uint256(_aux.ak_alpha_Y[13]);
			inputs[61] = uint256(_aux.ak_alpha_Y[14]);
			inputs[62] = uint256(_aux.ak_alpha_Y[15]);
			inputs[63] = uint256(_aux.whitelistedAssetIDs[0]);
			inputs[64] = uint256(_aux.whitelistedAssetIDs[1]);
			inputs[65] = uint256(_aux.whitelistedAssetIDs[2]);
			inputs[66] = uint256(_aux.whitelistedAssetIDs[3]);
			inputs[67] = uint256(_aux.whitelistedAssetIDs[4]);
			inputs[68] = uint256(_aux.whitelistedAssetIDs[5]);
			inputs[69] = uint256(_aux.whitelistedAssetIDs[6]);
			inputs[70] = uint256(_aux.whitelistedAssetIDs[7]);
			inputs[71] = uint256(_aux.whitelistedAssetIDs[8]);
			inputs[72] = uint256(_aux.whitelistedAssetIDs[9]);
			inputs[73] = uint256(_aux.feeInputNullifiers[0]);
			inputs[74] = uint256(_aux.feeInputNullifiers[1]);
			inputs[75] = uint256(_aux.feeOutputCommitments[0]);
			inputs[76] = uint256(_aux.feeOutputCommitments[1]);
			inputs[77] = uint256(_aux.fee_ak_alpha_X[0]);
			inputs[78] = uint256(_aux.fee_ak_alpha_X[1]);
			inputs[79] = uint256(_aux.fee_ak_alpha_Y[0]);
			inputs[80] = uint256(_aux.fee_ak_alpha_Y[1]);
			encodedInput = abi.encodePacked(inputs);
		} else {
			require(false, "Invalid edges");
		}

		return (encodedInput, result);
	}
}
