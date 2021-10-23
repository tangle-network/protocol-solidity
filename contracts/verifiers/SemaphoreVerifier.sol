/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../interfaces/ISemaphoreVerifier.sol";

contract SemaphoreVerifier is ISemaphoreVerifier {
	ISemaphoreVerifier2 public v2;
	ISemaphoreVerifier3 public v3;
	ISemaphoreVerifier4 public v4;
	ISemaphoreVerifier5 public v5;
	ISemaphoreVerifier6 public v6;

	constructor(
		ISemaphoreVerifier2 _verifier2,
		ISemaphoreVerifier3 _verifier3,
		ISemaphoreVerifier4 _verifier4,
		ISemaphoreVerifier5 _verifier5,
		ISemaphoreVerifier6 _verifier6		
	) {
		v2 = _verifier2;
		v3 = _verifier3;
		v4 = _verifier4;
		v5 = _verifier5;
		v6 = _verifier6;
	}
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		bytes memory input,
		uint8 maxEdges
	) override external view returns (bool r) {
		if (maxEdges == 1) {
			uint256[4] memory _inputs = abi.decode(input, (uint256[4]));
			return v2.verifyProof(a, b, c, _inputs);
		} else if (maxEdges == 2) {
			uint256[5] memory _inputs = abi.decode(input, (uint256[5]));
			return v3.verifyProof(a, b, c, _inputs);
		} else if (maxEdges == 3) {
			uint256[6] memory _inputs = abi.decode(input, (uint256[6]));
			return v4.verifyProof(a, b, c, _inputs);
		} else if (maxEdges == 4) {
			uint256[7] memory _inputs = abi.decode(input, (uint256[7]));
			return v5.verifyProof(a, b, c, _inputs);
		} else if (maxEdges == 5) {
			uint256[8] memory _inputs = abi.decode(input, (uint256[8]));
			return v6.verifyProof(a, b, c, _inputs);
		} else {
			return false;
		}
	}
}