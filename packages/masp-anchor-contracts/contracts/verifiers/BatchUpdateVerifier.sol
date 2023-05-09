/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "../interfaces/IBatchVerifier.sol";

contract BatchTreeVerifierSelector is IBatchTreeVerifierSelector {
	IBatchTreeVerifier public v4;
	IBatchTreeVerifier public v8;
	IBatchTreeVerifier public v16;
	IBatchTreeVerifier public v32;

	// IBatchTreeVerifier public v64;

	constructor(
		IBatchTreeVerifier _verifier_4,
		IBatchTreeVerifier _verifier_8,
		IBatchTreeVerifier _verifier_16,
		IBatchTreeVerifier _verifier_32
	) {
		v4 = _verifier_4;
		v8 = _verifier_8;
		v16 = _verifier_16;
		v32 = _verifier_32;
	}

	function verifyProof(
		uint[2] memory _a,
		uint[2][2] memory _b,
		uint[2] memory _c,
		uint[1] memory _input,
		uint256 _batchSize
	) external view override returns (bool) {
		if (_batchSize == 4) {
			return v4.verifyProof(_a, _b, _c, _input);
		} else if (_batchSize == 8) {
			return v8.verifyProof(_a, _b, _c, _input);
		} else if (_batchSize == 16) {
			return v16.verifyProof(_a, _b, _c, _input);
		} else if (_batchSize == 32) {
			return v32.verifyProof(_a, _b, _c, _input);
		} else {
			return false;
		}
	}
}
