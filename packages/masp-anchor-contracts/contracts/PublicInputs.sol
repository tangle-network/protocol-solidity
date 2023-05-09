// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;
pragma experimental ABIEncoderV2;

/**
    @notice Auxiliary public input struct made up of deserializable values
    @param publicAssetID the public asset ID of the asset being deposited or withdrawn
	@param publicTokenID tokenID of Nft
 */
struct MASPAuxPublicInputs {
	uint256 publicAssetID;
	uint256 publicTokenID;
	uint256[10] whitelistedAssetIDs;
	uint256[2] feeInputNullifiers;
	uint256[2] feeOutputCommitments;
}

struct SwapPublicInputs {
	bytes roots;
	uint256 aliceSpendNullifier;
	uint256 bobSpendNullifier;
	uint256 swapChainID;
	uint256 currentTimestamp;
	uint256 aliceChangeRecord;
	uint256 bobChangeRecord;
	uint256 aliceReceiveRecord;
	uint256 bobReceiveRecord;
}
