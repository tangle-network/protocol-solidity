/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

interface ILinkableAnchor {
  function setHandler(address _handler) external;
  function setBridge(address _bridge) external;
  function hasEdge(uint256 _chainID) external view returns (bool);
  function addEdge(
    uint256 sourceChainID,
    bytes32 root,
    uint256 latestLeafIndex
  ) external payable;
  function updateEdge(
    uint256 sourceChainID,
    bytes32 root,
    uint256 latestLeafIndex
  ) external payable;
}