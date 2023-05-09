/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

import "../interfaces/verifiers/IAnchorVerifier.sol";
import "../utils/ProofUtils.sol";

pragma solidity ^0.8.18;

contract TxProofVerifier is ProofUtils {
	IAnchorVerifier public verifier;

	constructor(IAnchorVerifier _verifier) {
		verifier = _verifier;
	}

	/**
        @notice Verifies a zero-knowledge proof of knowledge over the tree according
        to the underlying `Verifier` circuit this `AnchorBase` is using.
        @notice This aims to be as generic as currently needed to support our VAnchor (variable deposit) contracts.
        @param _proof The zero-knowledge proof bytes
        @param _input The public input packed bytes
        @return bool Whether the proof is valid
     */
	function verify(
		bytes memory _proof,
		bytes memory _input,
		bool smallInputs,
		uint8 maxEdges
	) internal view returns (bool) {
		uint256[8] memory p = abi.decode(_proof, (uint256[8]));
		(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = unpackProof(p);
		bool r = verifier.verifyProof(a, b, c, _input, maxEdges, smallInputs);
		require(r, "Invalid withdraw proof");
		return r;
	}
}
