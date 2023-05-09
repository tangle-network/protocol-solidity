/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

contract ProofUtils {
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
