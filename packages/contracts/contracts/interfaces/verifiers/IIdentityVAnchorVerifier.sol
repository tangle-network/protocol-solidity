/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/**
	@title IIdentityVAnchorVerifier join/split verifier interface with 2 edges
	and 2 inputs to 2 outputs.

	The X_Y (2_2) identifiers designate the following:
	- X is the # of edges supported on this VAnchor (i.e. 2)
	- Y is the # of inputs to the join/split transaction (i.e. 2)
 */
interface IIdentityVAnchorVerifier2_2 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[11] memory input
	) external view returns (bool r);
}

/**
	@title IVAnchorVerifier join/split verifier interface with 2 edges
	and 16 inputs to 2 outputs.

	The X_Y (2_16) identifiers designate the following:
	- X is the # of edges supported on this VAnchor (i.e. 2)
	- Y is the # of inputs to the join/split transaction (i.e. 16)
 */
interface IIdentityVAnchorVerifier2_16 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[25] memory input
	) external view returns (bool r);
}

/**
	@title IVAnchorVerifier join/split verifier interface with 8 edges
	and 2 inputs to 2 outputs.

	The X_Y (8_2) identifiers designate the following:
	- X is the # of edges supported on this VAnchor (i.e. 8)
	- Y is the # of inputs to the join/split transaction (i.e. 2)
 */
interface IIdentityVAnchorVerifier8_2 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[25] memory input
	) external view returns (bool r);
}

/**
	@title IVAnchorVerifier join/split verifier interface with 2 edges
	and 2 inputs to 2 outputs.

	The X_Y (8_16) identifiers designate the following:
	- X is the # of edges supported on this VAnchor (i.e. 8)
	- Y is the # of inputs to the join/split transaction (i.e. 16)
 */
interface IIdentityVAnchorVerifier8_16 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[31] memory input
	) external view returns (bool r);
}
