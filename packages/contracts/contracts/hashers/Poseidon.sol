/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/// @title Poseidon hash functions for 2, 3, 4, 5, and 6 input elements.
/// @author Webb Technologies.
/// @notice These contracts are meant to be used in the `PoseidonHasher.sol`
library PoseidonT2 {
	function poseidon(uint256[1] memory input) public pure returns (uint256) {}
}

library PoseidonT3 {
	function poseidon(uint256[2] memory input) public pure returns (uint256) {}
}

library PoseidonT4 {
	function poseidon(uint256[3] memory input) public pure returns (uint256) {}
}

library PoseidonT5 {
	function poseidon(uint256[4] memory input) public pure returns (uint256) {}
}

library PoseidonT6 {
	function poseidon(uint256[5] memory input) public pure returns (uint256) {}
}

library PoseidonT7 {
	function poseidon(uint256[6] memory input) public pure returns (uint256) {}
}
