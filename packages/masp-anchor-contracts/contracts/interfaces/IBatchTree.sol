/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

interface IBatchTree {
	function batchInsert(
		bytes calldata _proof,
		bytes32 _argsHash,
		bytes32 _currentRoot,
		bytes32 _newRoot,
		uint32 _pathIndices,
		bytes32[] calldata _leaves,
		uint32 _batchHeight
	) external;
}
