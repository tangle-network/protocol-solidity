/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

// import "../interfaces/verifiers/IAnchorVerifier.sol";
// import "../interfaces/verifiers/IVAnchorVerifier.sol";
import "../interfaces/verifiers/IBatchVerifier.sol";

contract BatchTreeVerifierSelector is IBatchTreeVerifierSelector {
	IBatchTreeVerifier public v4;
	IBatchTreeVerifier public v8;
	IBatchTreeVerifier public v16;
	// IBatchTreeVerifier public v32;
	// IBatchTreeVerifier public v64;

	constructor(
		IBatchTreeVerifier _verifier_4,
		IBatchTreeVerifier _verifier_8,
		IBatchTreeVerifier _verifier_16
	) {
		v4 = _verifier_4;
		v8 = _verifier_8;
		v16 = _verifier_16;
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
		} else {
            return false;
        }

	}
}