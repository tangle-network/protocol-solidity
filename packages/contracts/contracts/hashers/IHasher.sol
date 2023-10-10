/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/// @title Hasher interface for hashing 2 uint256 elements.
/// @author Webb Technologies.
/// @notice This contract is meant to be used to generalize over different hash functions.
interface IHasher {
	function hash1(uint256 value) external pure returns (uint256);

	function hash2(uint256[2] calldata array) external pure returns (uint256);

	function hash3(uint256[3] calldata array) external pure returns (uint256);

	function hash4(uint256[4] calldata array) external pure returns (uint256);

	function hash5(uint256[5] calldata array) external pure returns (uint256);

	function hash6(uint256[6] calldata array) external pure returns (uint256);

	function hash(uint256[] calldata values) external pure returns (uint256);

	/// @dev provides a 2 elemtns hash with left and right elements
	function hashLeftRight(uint256 _left, uint256 _right) external pure returns (uint256);

	/// @dev provides Zero (Empty) elements for a IHasher based MerkleTree. Up to 32 levels
	function zeros(uint256 i) external pure returns (bytes32);
}
