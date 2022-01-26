/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../trees/MerkleTreePoseidon.sol";
import "../interfaces/IVerifier.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

abstract contract LinkableTree is MerkleTreePoseidon, ReentrancyGuard {
  address public handler;

  uint8 public immutable maxEdges;

  struct Edge {
    uint64 chainID;
    bytes32 root;
    uint256 latestLeafIndex;
  }

  // maps sourceChainID to the index in the edge list
  mapping(uint256 => uint256) public edgeIndex;
  mapping(uint256 => bool) public edgeExistsForChain;
  Edge[] public edgeList;

  // map to store chainID => (rootIndex => root) to track neighbor histories
  mapping(uint256 => mapping(uint32 => bytes32)) public neighborRoots;
  // map to store the current historical root index for a chainID
  mapping(uint256 => uint32) public currentNeighborRootIndex;

  // linking events
  event EdgeAddition(uint64 chainID, uint256 latestLeafIndex, bytes32 merkleRoot);
  event EdgeUpdate(uint64 chainID, uint256 latestLeafIndex, bytes32 merkleRoot);

  /**
    @dev The constructor
    @param _hasher the address of hash contract
    @param _merkleTreeHeight the height of deposits' Merkle Tree
    @param _maxEdges the maximum # of edges this linkable tree connects to
  */
  constructor(
    address _handler,
    IPoseidonT3 _hasher,
    uint32 _merkleTreeHeight,
    uint8 _maxEdges
  ) MerkleTreePoseidon(_merkleTreeHeight, _hasher) {
    handler = _handler;
    maxEdges = _maxEdges;
  }

  function updateEdge(
    uint256 sourceChainID,
    bytes32 root,
    uint256 leafIndex
  ) onlyHandler external payable nonReentrant {
    if (this.hasEdge(sourceChainID)) {
      //Update Edge
      require(edgeExistsForChain[sourceChainID], "Chain must be integrated from the bridge before updates");
      require(edgeList[edgeIndex[sourceChainID]].latestLeafIndex < leafIndex, "New leaf index must be greater");
      require(leafIndex < edgeList[edgeIndex[sourceChainID]].latestLeafIndex + (65_536), "New leaf index must within 2^16 updates");
      uint index = edgeIndex[sourceChainID];
      // update the edge in the edge list
      edgeList[index] = Edge({
        chainID: sourceChainID,
        root: root,
        latestLeafIndex: leafIndex
      });
        // add to root histories
      uint32 neighborRootIndex = (currentNeighborRootIndex[sourceChainID] + 1) % ROOT_HISTORY_SIZE;
      currentNeighborRootIndex[sourceChainID] = neighborRootIndex;
      neighborRoots[sourceChainID][neighborRootIndex] = root;
      emit EdgeUpdate(sourceChainID, leafIndex, root);
    } else {
      //Add Edge
      require(edgeList.length < maxEdges, "This Anchor is at capacity");
      edgeExistsForChain[sourceChainID] = true;
      uint index = edgeList.length;
      Edge memory edge = Edge({
        chainID: sourceChainID,
        root: root,
        latestLeafIndex: leafIndex
      });
      edgeList.push(edge);
      edgeIndex[sourceChainID] = index;
      // add to root histories
      uint32 neighborRootIndex = 0;
      neighborRoots[sourceChainID][neighborRootIndex] = root;
      emit EdgeAddition(sourceChainID, leafIndex, root);
    }
  }

  /** @dev */
  function getLatestNeighborEdges() public view returns (Edge[] memory edges) {
    edges = new Edge[](maxEdges);
    for (uint256 i = 0; i < maxEdges; i++) {
      if (edgeList.length >= i + 1) {
        edges[i] = edgeList[i];
      } else {
        edges[i] = Edge({
          // merkle tree height for zeros
          root: zeros(levels),
          chainID: 0,
          latestLeafIndex: 0
        });
      }
    }
  }

  function getLatestNeighborRoots() public view returns (bytes32[] memory roots) {
    roots = new bytes32[](maxEdges);
    for (uint256 i = 0; i < maxEdges; i++) {
      if (edgeList.length >= i + 1) {
        roots[i] = edgeList[i].root;
      } else {
        // merkle tree height for zeros
        roots[i] = zeros(levels);
      }
    }
  }

  function isKnownNeighborRoot(uint256 neighborChainID, bytes32 _root) public view returns (bool) {
    if (_root == 0) {
      return false;
    }
    uint32 _currentRootIndex = currentNeighborRootIndex[neighborChainID];
    uint32 i = _currentRootIndex;
    do {
      if (_root == neighborRoots[neighborChainID][i]) {
        return true;
      }
      if (i == 0) {
        i = ROOT_HISTORY_SIZE;
      }
      i--;
    } while (i != _currentRootIndex);
    return false;
  }

  function isValidRoots(bytes32[] memory roots) public view returns (bool) {
    require(isKnownRoot(roots[0]), "Cannot find your merkle root");
    require(roots.length == maxEdges + 1, "Incorrect root array length");
    for (uint i = 0; i < edgeList.length; i++) {
      Edge memory _edge = edgeList[i];
      require(isKnownNeighborRoot(_edge.chainID, roots[i+1]), "Neighbor root not found");
    }
    return true;
  }

  modifier onlyHandler()  {
    require(msg.sender == handler, 'sender is not the handler');
    _;
  }

  function getChainId() public view returns (uint) {
    uint chainId;
    assembly { chainId := chainid() }
    return chainId;
  }

  function hasEdge(uint256 _chainID) external view returns (bool) {
    return edgeExistsForChain[_chainID];
  }

  function decodeRoots(bytes calldata roots) internal view returns (bytes32[] memory decodedRoots) {
    decodedRoots = new bytes32[](maxEdges + 1);
    for (uint i = 0; i <= maxEdges; i++) {
      decodedRoots[i] = bytes32(roots[32*i : 32*(i+1)]);
    }
  }

  function bytesToBytes32(bytes memory b, uint offset) internal pure returns (bytes32) {
    bytes32 out;

    for (uint i = 0; i < 32; i++) {
      out |= bytes32(b[offset + i] & 0xFF) >> (i * 8);
    }
    return out;
  }
}
