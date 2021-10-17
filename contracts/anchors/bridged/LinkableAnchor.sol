/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./AnchorBase.sol";
import "../../interfaces/ILinkableAnchor.sol";

abstract contract LinkableAnchor is AnchorBase, ILinkableAnchor {
  constructor(
    IVerifier _verifier,
    IPoseidonT3 _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    address _bridge,
    address _admin,
    address _handler,
    uint8 _maxEdges
  ) AnchorBase(_verifier, _hasher, _denomination, _merkleTreeHeight, _maxEdges) {
    bridge = _bridge;
    admin = _admin;
    handler = _handler;
  }

  function setHandler(address _handler) onlyBridge override external {
    handler = _handler;
  }

  function setBridge(address _bridge) onlyAdmin override external {
    bridge = _bridge;
  }

  function hasEdge(uint256 _chainID) override external view returns (bool) {
    return edgeExistsForChain[_chainID];
  }

  function addEdge(
    uint256 sourceChainID,
    bytes32 root,
    uint256 leafIndex
  ) onlyHandler override external payable nonReentrant {
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
    // emit update event
    bytes32[1] memory neighbors = getLatestNeighborRoots();
    emit RootHistoryUpdate(block.timestamp, neighbors);
  }

  function updateEdge(
    uint256 sourceChainID,
    bytes32 root,
    uint256 leafIndex
  ) onlyHandler override external payable nonReentrant {
    require(edgeExistsForChain[sourceChainID], "Chain must be integrated from the bridge before updates");
    require(edgeList[edgeIndex[sourceChainID]].latestLeafIndex < leafIndex, "New leaf index must be greater");
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
    // emit update event
    bytes32[1] memory neighbors = getLatestNeighborRoots();
    emit RootHistoryUpdate(block.timestamp, neighbors);
  }
}
