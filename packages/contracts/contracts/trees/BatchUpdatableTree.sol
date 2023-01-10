/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";
import "../interfaces/verifiers/IBatchVerifier.sol";
import "hardhat/console.sol";

contract BatchMerkleTree is MerkleTreeWithHistory {
    bytes32 public currentRoot;
    bytes32 public previousRoot;
    uint256 public queueLength;
    uint256 public lastProcessedLeaf;
    mapping(uint256 => bytes32) public queue;
    uint256 public constant ITEM_SIZE = 32; // + 20 + 4;
    uint256 public constant CHUNK_TREE_HEIGHT = 4;
    uint256 public constant CHUNK_SIZE = 2**CHUNK_TREE_HEIGHT;
    uint256 public constant BYTES_SIZE = 32 + 32 + 4 + CHUNK_SIZE * ITEM_SIZE;
    uint256 public constant SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    IBatchTreeUpdateVerifier public treeUpdateVerifier;


	constructor(uint32 _levels, IHasher _hasher, IBatchTreeUpdateVerifier _treeUpdateVerifier) {
		require(_levels > 0, "_levels should be greater than zero");
		require(_levels < 32, "_levels should be less than 32");
		levels = _levels;
		hasher = _hasher;
		treeUpdateVerifier = _treeUpdateVerifier;

		for (uint32 i = 0; i < _levels; i++) {
			filledSubtrees[i] = uint256(hasher.zeros(i));
		}
        queueLength = 0;
        lastProcessedLeaf = 0;

		roots[0] = Root(uint256(hasher.zeros(_levels)), 0);
        currentRoot = hasher.zeros(_levels);
	}
    event DepositData(address instance, bytes32 indexed hash, uint256 block, uint256 index);

    // TODO: MAKE THIS FUNCTION INTERNAL
    function registerInsertion(address _instance, bytes32 _commitment) public {
        uint256 _queueLength = queueLength;
        // queue[_queueLength] = keccak256(abi.encode(_instance, _commitment, blockNumber()));
        queue[_queueLength] = _commitment;
        emit DepositData(_instance, _commitment, blockNumber(), _queueLength);
        queueLength = queueLength + 1;
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
    bytes32[CHUNK_SIZE] calldata _leaves
  ) public {
    uint256 offset = lastProcessedLeaf;
    console.log('SOLIDITY: input current root: ', uint(_currentRoot));
    console.log('SOLIDITY: contract current root: ', uint(currentRoot));
    require(_currentRoot == currentRoot, "Initial deposit root is invalid");
    require(_pathIndices == offset >> CHUNK_TREE_HEIGHT, "Incorrect deposit insert index");

    bytes memory data = new bytes(BYTES_SIZE);
    assembly {
      mstore(add(data, 0x44), _pathIndices)
      mstore(add(data, 0x40), _newRoot)
      mstore(add(data, 0x20), _currentRoot)
    }
    for (uint256 i = 0; i < CHUNK_SIZE; i++) {
      // (bytes32 hash, address instance, uint32 blockNumber) = (_events[i].hash, _events[i].instance, _events[i].block);
      // bytes32 leafHash = keccak256(abi.encode(instance, hash, blockNumber));
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
    require(treeUpdateVerifier.verifyProof(a, b, c, [argsHash]), "Invalid deposit tree update proof");

    previousRoot = currentRoot;
    currentRoot = _newRoot;
    lastProcessedLeaf = offset + CHUNK_SIZE;
  }
  function blockNumber() public returns (uint256) {
      return block.number;
  }
	function unpackProof(
		uint256[8] memory _proof
	) public pure returns (uint256[2] memory, uint256[2][2] memory, uint256[2] memory) {
		return (
			[_proof[0], _proof[1]],
			[[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
			[_proof[6], _proof[7]]
		);
	}
}
