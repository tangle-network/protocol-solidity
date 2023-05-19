/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/*
 * Hasher interface for hashing 2 uint256 elements.
 */
interface IHasher {
	function hash3(uint256[3] memory array) external view returns (uint256);

	function hash4(uint256[4] memory array) external view returns (uint256);

	/// @dev provides a 2 elemtns hash with left and right elements
	function hashLeftRight(uint256 _left, uint256 _right) external view returns (uint256);

	/// @dev provides Zero (Empty) elements for a IHasher based MerkleTree. Up to 32 levels
	function zeros(uint256 i) external view returns (bytes32);
}
