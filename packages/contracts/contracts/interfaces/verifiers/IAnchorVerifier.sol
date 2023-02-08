/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.5;

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
