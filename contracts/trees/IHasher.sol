/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/*
 * Hasher interface for hashing 2 uint256 elements.
 */
interface IHasher {
    /// @dev provides a 2 elemtns hash with left and right elements
    function hashLeftRight(uint256 _left, uint256 _right) external view returns (uint256);
    /// @dev provides Zero (Empty) elements for a IHasher based MerkleTree. Up to 32 levels
    function zeros(uint256 i) external view returns (bytes32);
}
