/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

pragma solidity ^0.8.0;

import { SnarkConstants } from "./SnarkConstants.sol";

contract PoseidonT3 {
    function poseidon(uint256[2] memory input) public pure returns (uint256) {
        return 0;
    }
}

interface IPoseidonT3 {
    function poseidon(uint256[2] memory input) external pure returns (uint256);
}
