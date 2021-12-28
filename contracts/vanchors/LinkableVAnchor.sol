/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./VAnchorBase.sol";
import "../interfaces/ILinkableAnchor.sol";

abstract contract LinkableVAnchor is VAnchorBase, ILinkableAnchor {
  constructor(
    IVAnchorVerifier _verifier,
    uint32 _levels,
    address _hasher,
    PermissionedAccounts memory _permissions,
    uint8 _maxEdges
  ) VAnchorBase(
    _verifier,
    _levels,
    _hasher,
    _permissions,
    _maxEdges
  ) {
    permissions = _permissions;
  }

  function setVerifier(address newVerifier) onlyHandler override external {
    require(newVerifier != address(0), "Handler cannot be 0");
    verifier = IVAnchorVerifier(newVerifier);
  }

  function setHandler(address _handler) onlyHandler override external {
    permissions.handler = _handler;
  }

  function hasEdge(uint256 _chainID) external view returns (bool) {
    return edgeExistsForChain[_chainID];
  }

  function updateEdge(
    uint256 sourceChainID,
    bytes32 root,
    uint256 leafIndex
  ) onlyHandler override external payable nonReentrant {
    if (this.hasEdge(sourceChainID)) {
      //Update Edge
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
}
