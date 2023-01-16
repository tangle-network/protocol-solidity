// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

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
