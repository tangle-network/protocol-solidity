/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
	@title IVerifier2 interface for an Anchor Verifier with 2 edges
 */
interface IVerifier2 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[5] memory input
	) external view returns (bool r);
}

/**
	@title IVerifier3 interface for an Anchor Verifier with 3 edges
 */
interface IVerifier3 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[6] memory input
	) external view returns (bool r);
}

/**
	@title IVerifier4 interface for an Anchor Verifier with 4 edges
 */
interface IVerifier4 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[7] memory input
	) external view returns (bool r);
}

/**
	@title IVerifier5 interface for an Anchor Verifier with 5 edges
 */
interface IVerifier5 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[8] memory input
	) external view returns (bool r);
}

/**
	@title IVerifier6 interface for an Anchor Verifier with 6 edges
 */
interface IVerifier6 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[9] memory input
	) external view returns (bool r);
}
