/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 
pragma solidity ^0.8.0;

/**
    @title Interface for Bridge contract.
    @author ChainSafe Systems.
 */
interface IMintableCompToken {
  function transfer(address dst, uint rawAmount) external returns (bool);
  function transferFrom(address src, address dst, uint rawAmount) external returns (bool);
  function delegate(address delegatee) external;
  function delegateBySig(address delegatee, uint nonce, uint expiry, uint8 v, bytes32 r, bytes32 s) external;
  function getCurrentVotes(address account) external view returns (uint256);
  function getPriorVotes(address account, uint blockNumber) external view returns (uint256);
  function mint(address to, uint256 amount) external;
}