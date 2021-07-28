/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

pragma solidity ^0.8.0;

interface ILinkableAnchor {
  function setHandler(address _handler) external;
  function setBridge(address _bridge) external;
  function recordHistory() external;
  function hasEdge(uint8 _chainID) external view returns (bool);
  function addEdge(
    uint8 sourceChainID,
    bytes32 resourceID,
    bytes32 root,
    uint256 height
  ) external payable;
  function updateEdge(
    uint8 sourceChainID,
    bytes32 resourceID,
    bytes32 root,
    uint256 height
  ) external payable;
}
