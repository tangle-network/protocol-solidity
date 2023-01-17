/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
    @title IMASPVAnchorVerifier join/split verifier interface with 2 edges
    and 2 inputs to 2 outputs.

    The X_Y (2_2) identifiers designate the following:
    - X is the # of edges supported on this VAnchor (i.e. 2)
    - Y is the # of inputs to the join/split transaction (i.e. 2)
 */
interface IMASPVAnchorVerifier2_2 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint[33] memory input
	) external view returns (bool r);
}

/**
    @title IMASPVAnchorVerifier join/split verifier interface with 2 edges
    and 16 inputs to 2 outputs.

    The X_Y (2_16) identifiers designate the following:
    - X is the # of edges supported on this VAnchor (i.e. 2)
    - Y is the # of inputs to the join/split transaction (i.e. 16)
 */
interface IMASPVAnchorVerifier2_16 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[39] memory input
	) external view returns (bool r);
}

/**
    @title IMASPVAnchorVerifier join/split verifier interface with 8 edges
    and 2 inputs to 2 outputs.

    The X_Y (8_2) identifiers designate the following:
    - X is the # of edges supported on this VAnchor (i.e. 8)
    - Y is the # of inputs to the join/split transaction (i.e. 2)
 */
interface IMASPVAnchorVerifier8_2 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint[74] memory input
	) external view returns (bool r);
}

/**
    @title IMASPVAnchorVerifier join/split verifier interface with 2 edges
    and 2 inputs to 2 outputs.

    The X_Y (8_16) identifiers designate the following:
    - X is the # of edges supported on this VAnchor (i.e. 8)
    - Y is the # of inputs to the join/split transaction (i.e. 16)
 */
interface IMASPVAnchorVerifier8_16 {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint256[80] memory input
	) external view returns (bool r);
}
