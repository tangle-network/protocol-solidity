/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/**
    @title IAnchorVerifier interface
    @notice A generic interface for verifying zero-knowledge proofs for anchors of different sizes.
 */
interface IAnchorVerifier {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		bytes memory input,
		uint8 maxEdges,
		bool smallInputs
	) external view returns (bool r);
}
