/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../../trees/MerkleTreePoseidon.sol";
import "../../interfaces/IVerifier.sol";
import "./LinkableTree.sol";

abstract contract AnchorBaseV2 is LinkableTree {
  IVerifier public immutable verifier;

  // map to store used nullifier hashes
  mapping(bytes32 => bool) public nullifierHashes;
  // map to store all commitments to prevent accidental deposits with the same commitment
  mapping(bytes32 => bool) public commitments;

  event Insertion(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);

  /**
    @dev The constructor
    @param _verifier the address of SNARK verifier for this contract
    @param _hasher the address of hash contract
    @param _merkleTreeHeight the height of deposits' Merkle Tree
  */
  constructor(
    IVerifier _verifier,
    IPoseidonT3 _hasher,
    uint32 _merkleTreeHeight,
    uint8 _maxEdges
  ) LinkableTree(_hasher, _merkleTreeHeight, _maxEdges) {
    verifier = _verifier;
  }

  /**
    @dev Inserts a commitment into the tree
    @param _commitment the note commitment = Poseidon(chainId, nullifier, secret)
  */
  function insert(bytes32 _commitment) external payable nonReentrant {
    require(!commitments[_commitment], "The commitment has been submitted");

    uint32 insertedIndex = _insert(_commitment);
    commitments[_commitment] = true;
    _processInsertion();

    emit Insertion(_commitment, insertedIndex, block.timestamp);
  }

  /** @dev this function is defined in a child contract */
  function _processInsertion() internal virtual;

  function verify(
    bytes memory _proof,
    bytes memory _input
  ) internal view returns (bool r) {
    uint256[8] memory p = abi.decode(_proof, (uint256[8]));
    (
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c
    ) = unpackProof(p);
    r = verifier.verifyProof(
      a, b, c,
      _input,
      maxEdges
    );
    require(r, "Invalid withdraw proof");
    return r;
  }

  /*
  * A helper function to convert an array of 8 uint256 values into the a, b,
  * and c array values that the zk-SNARK verifier's verifyProof accepts.
  */
  function unpackProof(
      uint256[8] memory _proof
  ) public pure returns (
      uint256[2] memory,
      uint256[2][2] memory,
      uint256[2] memory
  ) {
    return (
      [_proof[0], _proof[1]],
      [
        [_proof[2], _proof[3]],
        [_proof[4], _proof[5]]
      ],
      [_proof[6], _proof[7]]
    );
  }
}
