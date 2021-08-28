/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./2/Anchor2.sol";

contract AnchorFactoryPoseidon {
  function createAnchor2(
    IVerifier _verifier,
    IPoseidonT3 _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint32 _chainID,
    ITokenWrapper _token,
    address _bridge,
    address _admin,
    address _handler
  ) external {
    new Anchor2(
      _verifier,
      _hasher,
      _denomination,
      _merkleTreeHeight,
      _chainID,
      _token,
      _bridge,
      _admin,
      _handler
    );
  }

  function create2Anchor2(
    bytes32 _salt,
    IVerifier _verifier,
    IPoseidonT3 _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint32 _chainID,
    ITokenWrapper _token,
    address _bridge,
    address _admin,
    address _handler
  ) external {
    new Anchor2{salt: _salt}(
      _verifier,
      _hasher,
      _denomination,
      _merkleTreeHeight,
      _chainID,
      _token,
      _bridge,
      _admin,
      _handler
    );
  }
}