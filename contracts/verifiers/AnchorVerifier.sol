/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../interfaces/IAnchorVerifier.sol";
import "../interfaces/IVerifier.sol";

contract Verifier is IAnchorVerifier {
	IVerifier2 public v2;
	IVerifier3 public v3;
	IVerifier4 public v4;
	IVerifier5 public v5;
	IVerifier6 public v6;

	constructor(
		IVerifier2 _verifier2,
		IVerifier3 _verifier3,
		IVerifier4 _verifier4,
		IVerifier5 _verifier5,
		IVerifier6 _verifier6		
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
		uint8 maxEdges,
		bool _unused
	) override external view returns (bool r) {
		if (maxEdges == 1) {
			uint256[5] memory _inputs = abi.decode(input, (uint256[5]));
			return v2.verifyProof(a, b, c, _inputs);
		} else if (maxEdges == 2) {
			uint256[6] memory _inputs = abi.decode(input, (uint256[6]));
			return v3.verifyProof(a, b, c, _inputs);
		} else if (maxEdges == 3) {
			uint256[7] memory _inputs = abi.decode(input, (uint256[7]));
			return v4.verifyProof(a, b, c, _inputs);
		} else if (maxEdges == 4) {
			uint256[8] memory _inputs = abi.decode(input, (uint256[8]));
			return v5.verifyProof(a, b, c, _inputs);
		} else if (maxEdges == 5) {
			uint256[9] memory _inputs = abi.decode(input, (uint256[9]));
			return v6.verifyProof(a, b, c, _inputs);
		} else {
			return false;
		}
	}
}
