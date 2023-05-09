/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "@webb-tools/protocol-solidity/trees/MerkleTreeWithHistory.sol";
import "@webb-tools/protocol-solidity/utils/ProofUtils.sol";
import "../interfaces/IBatchVerifier.sol";

contract BatchMerkleTree is MerkleTreeWithHistory, ProofUtils {
	bytes32 public currentRoot;
	bytes32 public previousRoot;
	uint256 public queueLength;
	mapping(uint256 => bytes32) public queue;
	// uint256 public constant CHUNK_TREE_HEIGHT = 4;
	// uint256 public constant CHUNK_SIZE = 2**CHUNK_TREE_HEIGHT;
	// uint256 public constant BYTES_SIZE = 32 + 32 + 4 + CHUNK_SIZE * ITEM_SIZE;
	uint256 public constant HEADER_SIZE = 32 + 32 + 4;
	uint256 public constant ITEM_SIZE = 32; // + 20 + 4;
	uint256 public constant SNARK_FIELD =
		21888242871839275222246405745257275088548364400416034343698204186575808495617;
	IBatchTreeVerifierSelector public treeUpdateVerifier;

	constructor(uint32 _levels, IHasher _hasher, IBatchTreeVerifierSelector _treeUpdateVerifier) {
		require(_levels > 0, "_levels should be greater than zero");
		require(_levels < 32, "_levels should be less than 32");
		levels = _levels;
		hasher = _hasher;
		treeUpdateVerifier = _treeUpdateVerifier;

		for (uint32 i = 0; i < _levels; i++) {
			filledSubtrees[i] = uint256(hasher.zeros(i));
		}
		queueLength = 0;
		roots[0] = Root(uint256(hasher.zeros(_levels)), 0);
		currentRoot = hasher.zeros(_levels);
	}

	function _registerInsertion(address _instance, bytes32 _commitment) internal {
		queue[queueLength] = _commitment;
		emit DepositData(_instance, _commitment, block.number, queueLength);
		queueLength = queueLength + 1;
	}

	event DepositData(address instance, bytes32 indexed hash, uint256 block, uint256 index);

	function checkLeavesLength(bytes32[] calldata _leaves) public {
		require(
			_leaves.length == 4 ||
				_leaves.length == 8 ||
				_leaves.length == 16 ||
				_leaves.length == 32,
			"Invalid number of leaves"
		);
	}

	/// @dev Insert a full batch of queued deposits into a merkle tree
	/// @param _proof A snark proof that elements were inserted correctly
	/// @param _argsHash A hash of snark inputs
	/// @param _currentRoot Current merkle tree root
	/// @param _newRoot Updated merkle tree root
	/// @param _pathIndices Merkle path to inserted batch
	/// @param _leaves A batch of inserted leaves
	function batchInsert(
		bytes calldata _proof,
		bytes32 _argsHash,
		bytes32 _currentRoot,
		bytes32 _newRoot,
		uint32 _pathIndices,
		bytes32[] calldata _leaves,
		uint32 _batchHeight
	) public {
		uint256 offset = nextIndex;

		require(_currentRoot == currentRoot, "Initial deposit root is invalid");
		require(_pathIndices == offset >> _batchHeight, "Incorrect deposit insert index");
		this.checkLeavesLength(_leaves);

		bytes memory data = new bytes(HEADER_SIZE + ITEM_SIZE * _leaves.length);
		assembly {
			mstore(add(data, 0x44), _pathIndices)
			mstore(add(data, 0x40), _newRoot)
			mstore(add(data, 0x20), _currentRoot)
		}
		for (uint256 i = 0; i < _leaves.length; i++) {
			bytes32 leafHash = _leaves[i];
			bytes32 deposit = queue[offset + i];
			require(leafHash == deposit, "Incorrect deposit");
			assembly {
				let itemOffset := add(data, mul(ITEM_SIZE, i))
				mstore(add(itemOffset, 0x64), leafHash)
			}
			delete queue[offset + i];
		}

		uint256 argsHash = uint256(sha256(data)) % SNARK_FIELD;
		require(argsHash == uint256(_argsHash), "Invalid args hash");
		uint256[8] memory p = abi.decode(_proof, (uint256[8]));
		(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = unpackProof(p);
		require(
			treeUpdateVerifier.verifyProof(a, b, c, [argsHash], _leaves.length),
			"Invalid deposit tree update proof"
		);

		previousRoot = currentRoot;
		currentRoot = _newRoot;

		uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
		nextIndex = nextIndex + uint32(_leaves.length);
		roots[newRootIndex] = Root(uint256(currentRoot), nextIndex);
		currentRootIndex = newRootIndex;
	}
}
