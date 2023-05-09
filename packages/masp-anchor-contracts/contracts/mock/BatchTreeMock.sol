/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity ^0.8.18;

import "@webb-tools/protocol-solidity/hashers/IHasher.sol";
import "../trees/BatchUpdatableTree.sol";
import "../interfaces/IBatchVerifier.sol";

contract BatchMerkleTreeMock is BatchMerkleTree {
	constructor(
		uint32 _levels,
		IHasher _hasher,
		IBatchTreeVerifierSelector _treeUpdateVerifier
	) BatchMerkleTree(_levels, _hasher, _treeUpdateVerifier) {}

	function registerInsertion(address _instance, bytes32 _commitment) public {
		_registerInsertion(_instance, _commitment);
	}
}
