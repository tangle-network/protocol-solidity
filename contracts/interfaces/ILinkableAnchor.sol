/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

interface ILinkableAnchor {
  function setHandler(address _handler, uint32 nonce) external;
  function setVerifier(address _verifier, uint32 nonce) external;
  function configureLimits(uint256 _minimalWithdrawalAmount, uint256 _maximumDepositAmount) external;
  
  function updateEdge(
    uint256 sourceChainID,
    bytes32 root,
    uint256 latestLeafIndex
  ) external payable;
}