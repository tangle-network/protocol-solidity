/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

import "@webb-tools/protocol-solidity/utils/ProofUtils.sol";
import "../interfaces/ISwapVerifier.sol";

contract SwapProofVerifier is ISwapVerifier, ProofUtils {
	ISwapVerifier2 public v2;
	ISwapVerifier8 public v8;

	constructor(ISwapVerifier2 _verifier2, ISwapVerifier8 _verifier8) {
		v2 = _verifier2;
		v8 = _verifier8;
	}

	function verifySwap(
		bytes memory _proof,
		bytes memory input,
		uint8 maxEdges
	) external view override returns (bool r) {
		uint256[8] memory p = abi.decode(_proof, (uint256[8]));
		(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = unpackProof(p);
		if (maxEdges == 1) {
			uint256[10] memory _inputs = abi.decode(input, (uint256[10]));
			return v2.verifyProof(a, b, c, _inputs);
		} else if (maxEdges == 7) {
			uint256[16] memory _inputs = abi.decode(input, (uint256[16]));
			return v8.verifyProof(a, b, c, _inputs);
		} else {
			return false;
		}
	}
}
