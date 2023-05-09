/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

/**
    @title IAnchorVerifier interface
    @notice A generic interface for verifying zero-knowledge proofs for anchors of different sizes.
 */
interface ISwapVerifier {
	function verifySwap(
		bytes memory _proof,
		bytes memory input,
		uint8 maxEdges
	) external view returns (bool r);
}

interface ISwapVerifier2 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[10] memory input
	) external view returns (bool r);
}

interface ISwapVerifier8 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[16] memory input
	) external view returns (bool r);
}
