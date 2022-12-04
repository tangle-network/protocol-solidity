/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../trees/MerkleTree.sol";
import "./LinkableAnchorForest.sol";
import "hardhat/console.sol";

/**
    @title AnchorBase contract
    @notice Base contract for interoperable anchors. Each anchor base
    is a LinkableAnchor which allows it to be connected to other LinkableAnchors.
 */
abstract contract AnchorForest is LinkableAnchorForest {
    // map to store used nullifier hashes
    mapping(bytes32 => bool) public nullifierHashes;
    // map to store all commitments to prevent accidental deposits with the same commitment
    mapping(bytes32 => bool) public commitments;

    event Insertion(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);

    /**
        @notice The constructor
        @param _handler The address of AnchorHandler for this contract
        @param _hasher The address of hash contract
        @param _merkleTreeHeight The height of deposits' Merkle Tree
        @param _maxEdges The maximum number of edges in the LinkableAnchor + Verifier supports.
        @notice The `_maxEdges` is zero-knowledge circuit dependent, meaning the
        `_verifier` ONLY supports a certain maximum # of edges. Therefore we need to
        limit the size of the LinkableAnchor with this parameter.
    */
    constructor(
        address _handler,
        IHasher _hasher,
        uint32 _forestHeight,
        uint32 _merkleTreeHeight,
        uint8 _maxEdges
    ) LinkableAnchorForest(_handler, _hasher, _forestHeight, _merkleTreeHeight, _maxEdges) {}

    /**
        @notice Inserts two commitments into the tree. Useful for contracts
        that need to insert two commitments at once.
        @notice This is an internal function and meant to be used by a child contract.
        @param _firstCommitment The first note commitment
        @param _secondCommitment The second note commitment
        @return uint32 The index of the first inserted commitment
     */
    function insertTwo(bytes32 _firstCommitment, bytes32 _secondCommitment) internal returns(uint32) {
        require(!commitments[_firstCommitment], "The commitment has been submitted");
        require(!commitments[_secondCommitment], "The commitment has been submitted");
        uint32 insertedIndex = _insertTwo(_firstCommitment, _secondCommitment);
        commitments[_firstCommitment] = true;
        commitments[_secondCommitment] = true;
        emit Insertion(_firstCommitment, insertedIndex, block.timestamp);
        emit Insertion(_secondCommitment, insertedIndex + 1, block.timestamp);

        return insertedIndex;
    }

    /**
        @notice Whether a note is already spent
        @param _nullifierHash The nullifier hash of the deposit note
        @return bool Whether the note is already spent
    */
    function isSpent(bytes32 _nullifierHash) public view returns (bool) {
        return nullifierHashes[_nullifierHash];
    }

    /**
        @notice Whether an array of notes is already spent
        @param _nullifierHashes The array of nullifier hashes of the deposit notes
        @return bool[] An array indicated whether each note's nullifier hash is already spent
    */
    function isSpentArray(bytes32[] calldata _nullifierHashes) external view returns (bool[] memory) {
        bool[] memory spent = new bool[](_nullifierHashes.length);
        for (uint256 i = 0; i < _nullifierHashes.length; i++) {
            if (isSpent(_nullifierHashes[i])) {
                spent[i] = true;
            }
        }

        return spent;
    }

    /**
        @notice Set a new handler with a nonce
        @dev Can only be called by the `AnchorHandler` contract
        @param _handler The new handler address
        @param _nonce The nonce for updating the new handler
     */
    function setHandler(
        address _handler,
        uint32 _nonce
    ) override onlyHandler onlyIncrementingByOne(_nonce) external {
        require(_handler != address(0), "Handler cannot be 0");
        handler = _handler;
    }
}
