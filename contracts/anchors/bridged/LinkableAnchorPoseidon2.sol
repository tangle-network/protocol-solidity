/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./AnchorPoseidon2.sol";
import "../../interfaces/ILinkableAnchor.sol";

abstract contract LinkableAnchorPoseidon2 is AnchorPoseidon2, ILinkableAnchor {
  constructor(
    IVerifier _verifier,
    IPoseidonT3 _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint32 _chainID
  ) AnchorPoseidon2(_verifier, _hasher, _denomination, _merkleTreeHeight, _chainID) {
    // set the sender as admin & bridge & handler address
    // TODO: Properly set addresses and permissions
    bridge = msg.sender;
    admin = msg.sender;
    handler = msg.sender;
  }

  function setHandler(address _handler) onlyBridge override external {
    handler = _handler;
  }

  function setBridge(address _bridge) onlyAdmin override external {
    bridge = _bridge;
  }

  function hasEdge(uint8 _chainID) override external view returns (bool) {
    return edgeExistsForChain[_chainID];
  }

  function recordHistory() override external {
    // add a new historical record by snapshotting the Anchor's current neighbors
    bytes32[1] memory history = getLatestNeighborRoots();
    rootHistory[latestHistoryIndex] = history;
    // set the next history index modulo pruning length
    latestHistoryIndex = latestHistoryIndex % pruningLength;
    emit RootHistoryRecorded(block.timestamp, history);
  }

  function addEdge(
    uint8 sourceChainID,
    bytes32 resourceID,
    bytes32 root,
    uint256 height
  ) onlyHandler override external payable nonReentrant {
    require(edgeList.length < 1, "This Anchor is at capacity");
    edgeExistsForChain[sourceChainID] = true;
    uint index = edgeList.length;
    Edge memory edge = Edge({
      chainID: sourceChainID,
      resourceID: resourceID,
      root: root,
      height: height
    });
    edgeList.push(edge);
    edgeIndex[resourceID] = index;
    emit EdgeAddition(sourceChainID, resourceID, height, root);
    // emit update event
    bytes32[1] memory neighbors = getLatestNeighborRoots();
    emit RootHistoryUpdate(block.timestamp, neighbors);
    
  }

  function updateEdge(
    uint8 sourceChainID,
    bytes32 resourceID,
    bytes32 root,
    uint256 height
  ) onlyHandler override external payable nonReentrant {
    require(edgeExistsForChain[sourceChainID], "Chain must be integrated from the bridge before updates");
    require(edgeList[edgeIndex[resourceID]].height < height, "New height must be greater");
    uint index = edgeIndex[resourceID];
    // update the edge in the edge list
    edgeList[index] = Edge({
      chainID: sourceChainID,
      resourceID: resourceID,
      root: root,
      height: height
    });
    emit EdgeUpdate(sourceChainID, resourceID, height, root);
    // emit update event
    bytes32[1] memory neighbors = getLatestNeighborRoots();
    emit RootHistoryUpdate(block.timestamp, neighbors);
  }
}
