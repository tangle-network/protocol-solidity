/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
    @title Interface for Treasury contract.
    @author Webb Technologies.
 */
interface ITreasury {
  function rescueTokens(address tokenAddress, address payable to, uint256 amountToRescue, uint256 nonce) external;
  function setHandler(address newHandler, uint256 nonce) external;
}
