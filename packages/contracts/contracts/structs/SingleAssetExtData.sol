/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/// @title SingleAssetExtData struct for encoding external data for single asset proofs
/// @author Webb Technologies.
/// @notice This contract is meant to be used to encode external data for hashing to verify proofs.

/// @dev The SingleAssetExtData struct is used to store the external data for single asset proofs.
/// @param recipient The recipient of the transaction
/// @param extAmount The external amount being transferred
/// @param relayer The relayer of the transaction
/// @param fee The fee for the transaction
/// @param refund The refund for the transaction
/// @param token The token being wrapped/unwrapped or transferred if its the shielded pool token
/// @param encryptedOutput1 The encrypted output 1 for the transaction
/// @param encryptedOutput2 The encrypted output 2 for the transaction
struct ExtData {
	address recipient;
	int256 extAmount;
	address relayer;
	uint256 fee;
	uint256 refund;
	address token;
	bytes encryptedOutput1;
	bytes encryptedOutput2;
}
