/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

pragma solidity ^0.8.0;

import "./Anchor.sol";

abstract contract LinkableAnchor is Anchor {
  constructor(
    IVerifier _verifier,
    IHasher _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint32 _maxRoots
  ) Anchor(_verifier, _hasher, _denomination, _merkleTreeHeight, _maxRoots) {
    // set the sender as admin & bridge & handler address
    // TODO: Properly set addresses and permissions
    bridge = msg.sender;
    admin = msg.sender;
    handler = msg.sender;
  }

  function setHandler(address _handler) onlyBridge external {
    handler = _handler;
  }

  function setBridge(address _bridge) onlyAdmin external {
    bridge = _bridge;
  }

  function recordHistory() external {
    // add a new historical record by snapshotting the Anchor's current neighbors
    bytes32[] memory history = getLatestNeighborRoots();
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
  ) onlyHandler external payable nonReentrant {
    require(edgeList.length < maxRoots, "This Anchor is at capacity");
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
    bytes32[] memory neighbors = getLatestNeighborRoots();
    neighbors[index] = root;
    emit RootHistoryUpdate(block.timestamp, neighbors);
    
  }

  function updateEdge(
    uint8 sourceChainID,
    bytes32 resourceID,
    bytes32 root,
    uint256 height
  ) onlyHandler external payable nonReentrant {
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
    bytes32[] memory neighbors = getLatestNeighborRoots();
    neighbors[index] = root;
    emit RootHistoryUpdate(block.timestamp, neighbors);
  }
}
