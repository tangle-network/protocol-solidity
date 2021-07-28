/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

pragma solidity ^0.8.0;

interface ILinkableAnchor {
  function setHandler(address _handler) external;
  function setBridge(address _bridge) external;
  function recordHistory() external;
  function hasEdge(uint256 _chainID) external view returns (bool);
  function addEdge(
    uint256 sourceChainID,
    bytes32 root,
    uint256 height
  ) external payable;
  function updateEdge(
    uint256 sourceChainID,
    bytes32 root,
    uint256 height
  ) external payable;
}
