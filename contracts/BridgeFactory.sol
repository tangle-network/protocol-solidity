/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./Bridge.sol";

contract BridgeFactory {
  function createBridge(
    uint256 chainID,
    address[] memory initialRelayers,
    uint256 initialRelayerThreshold,
    uint256 fee,
    uint256 expiry
  ) external {
    new Bridge(
      chainID,
      initialRelayers,
      initialRelayerThreshold,
      fee,
      expiry
    );
  }

  function create2Bridge(
    bytes32 _salt,
    uint256 chainID,
    address[] memory initialRelayers,
    uint256 initialRelayerThreshold,
    uint256 fee,
    uint256 expiry
  ) external {
    new Bridge{salt: _salt}(
      chainID,
      initialRelayers,
      initialRelayerThreshold,
      fee,
      expiry
    );
  }
}