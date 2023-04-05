/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: Apache 2.0/MIT
 */

import "../interfaces/verifiers/IAnchorVerifier.sol";

pragma solidity ^0.8.5;

contract TxProofVerifier {
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

	/**
        @notice A helper function to convert an array of 8 uint256 values into the a, b,
        and c array values that the zk-SNARK verifier's verifyProof accepts.
        @param _proof The array of 8 uint256 values
        @return (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) The unpacked proof values
    */
	function unpackProof(
		uint256[8] memory _proof
	) public pure returns (uint256[2] memory, uint256[2][2] memory, uint256[2] memory) {
		return (
			[_proof[0], _proof[1]],
			[[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
			[_proof[6], _proof[7]]
		);
	}
}
