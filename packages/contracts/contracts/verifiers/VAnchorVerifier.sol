/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "../interfaces/verifiers/IAnchorVerifier.sol";
import "../interfaces/verifiers/IVAnchorVerifier.sol";

contract VAnchorVerifier is IAnchorVerifier {
	IVAnchorVerifier2_2 public v2_2;
	IVAnchorVerifier2_16 public v2_16;

	IVAnchorVerifier8_2 public v8_2;
	IVAnchorVerifier8_16 public v8_16;

	constructor(
		IVAnchorVerifier2_2 _verifier_2_2,
		IVAnchorVerifier2_16 _verifier_2_16,
		IVAnchorVerifier8_2 _verifier_8_2,
		IVAnchorVerifier8_16 _verifier_8_16
	) {
		v2_2 = _verifier_2_2;
		v2_16 = _verifier_2_16;
		v8_2 = _verifier_8_2;
		v8_16 = _verifier_8_16;
	}

	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		bytes memory input,
		uint8 maxEdges,
		bool smallInputs
	) external view override returns (bool r) {
		if (maxEdges == 1) {
			if (smallInputs) {
				uint256[9] memory _inputs = abi.decode(input, (uint256[9]));
				return v2_2.verifyProof(a, b, c, _inputs);
			} else {
				uint256[23] memory _inputs = abi.decode(input, (uint256[23]));
				return v2_16.verifyProof(a, b, c, _inputs);
			}
		} else if (maxEdges == 7) {
			if (smallInputs) {
				uint256[15] memory _inputs = abi.decode(input, (uint256[15]));
				return v8_2.verifyProof(a, b, c, _inputs);
			} else {
				uint256[29] memory _inputs = abi.decode(input, (uint256[29]));
				return v8_16.verifyProof(a, b, c, _inputs);
			}
		} else {
			return false;
		}
	}
}
