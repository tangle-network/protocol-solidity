/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./SemaphoreAnchorBase.sol";
import "../interfaces/ILinkableAnchor.sol";

abstract contract LinkableAnchor is SemaphoreAnchorBase, ILinkableAnchor {
  constructor(
    ISemaphoreVerifier _verifier,
    uint8 _merkleTreeHeight,
    address _bridge,
    address _admin,
    address _handler,
    uint232 _firstExternalNullifier,
    uint8 _maxEdges
  ) SemaphoreAnchorBase(_verifier, _merkleTreeHeight, _firstExternalNullifier, _maxEdges) {
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
  }
}
