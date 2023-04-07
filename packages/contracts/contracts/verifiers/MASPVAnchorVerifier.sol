/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.5;

import "../interfaces/verifiers/IAnchorVerifier.sol";
import "../interfaces/verifiers/IMASPVAnchorVerifier.sol";
import "hardhat/console.sol";

contract MASPVAnchorVerifier is IAnchorVerifier {
	IMASPVAnchorVerifier2_2 public v2_2;
	IMASPVAnchorVerifier2_16 public v2_16;

	IMASPVAnchorVerifier8_2 public v8_2;
	IMASPVAnchorVerifier8_16 public v8_16;

	constructor(
		IMASPVAnchorVerifier2_2 _verifier_2_2,
		IMASPVAnchorVerifier2_16 _verifier_2_16,
		IMASPVAnchorVerifier8_2 _verifier_8_2,
		IMASPVAnchorVerifier8_16 _verifier_8_16
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
		console.log("MASPVAnchorVerifier 1");
		if (maxEdges == 1) {
			console.log("MASPVAnchorVerifier 2");
			if (smallInputs) {
				console.log("MASPVAnchorVerifier 3");
				uint256[33] memory _inputs = abi.decode(input, (uint256[33]));
				return v2_2.verifyProof(a, b, c, _inputs);
			} else {
				console.log("MASPVAnchorVerifier 4");
				uint256[39] memory _inputs = abi.decode(input, (uint256[39]));
				return v2_16.verifyProof(a, b, c, _inputs);
			}
		} else if (maxEdges == 7) {
			if (smallInputs) {
				uint256[74] memory _inputs = abi.decode(input, (uint256[74]));
				return v8_2.verifyProof(a, b, c, _inputs);
			} else {
				uint256[80] memory _inputs = abi.decode(input, (uint256[80]));
				return v8_16.verifyProof(a, b, c, _inputs);
			}
		} else {
			return false;
		}
	}
}
