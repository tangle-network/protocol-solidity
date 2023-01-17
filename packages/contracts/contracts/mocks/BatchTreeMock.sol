// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../trees/BatchUpdatableTree.sol";
import "../hashers/IHasher.sol";
import "../interfaces/verifiers/IBatchVerifier.sol";

contract BatchMerkleTreeMock is BatchMerkleTree {
	constructor(uint32 _levels, IHasher _hasher, IBatchTreeVerifierSelector _treeUpdateVerifier) BatchMerkleTree(_levels, _hasher, _treeUpdateVerifier) {}

	function registerInsertion(address _instance, bytes32 _commitment) public {
        _registerInsertion(_instance, _commitment);
	}
}
