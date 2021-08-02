/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

interface IPoseidonT3 {
    function poseidon(uint256[2] memory input) external pure returns (uint256);
}

contract PoseidonT3 is IPoseidonT3 {
    function poseidon(uint256[2] memory input) override external pure returns (uint256) {
        return 0;
    }
}
