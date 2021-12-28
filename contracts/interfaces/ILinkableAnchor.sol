/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

interface ILinkableAnchor {
  function setHandler(address _handler) external;
  function setVerifier(address _verifier) external;
  function updateEdge(
    uint256 sourceChainID,
    bytes32 root,
    uint256 latestLeafIndex
  ) external payable;
}