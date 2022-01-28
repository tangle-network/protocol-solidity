/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
    @title Interface for SignatureBridge contract.
    @author Webb Technologies.
 */
interface ISignatureBridge {
  function executeProposalWithSignature(bytes calldata data, bytes memory sig) external;
  function adminSetResourceWithSignature(bytes calldata data, bytes memory sig) external;
  function rescueTokens(address tokenAddress, address payable to, uint256 amountToRescue, uint256 nonce) external;
  function setBridgeHandler(address newHandler, uint32 nonce) external;
}