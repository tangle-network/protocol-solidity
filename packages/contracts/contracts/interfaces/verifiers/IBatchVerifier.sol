/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

interface IBatchTreeVerifierSelector {
	function verifyProof(
		uint[2] memory _a,
		uint[2][2] memory _b,
		uint[2] memory _c,
		uint[1] memory _input,
		uint256 _batchSize
	) external view returns (bool);
}

interface IBatchTreeVerifier {
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint[1] memory input
	) external view returns (bool);
}
