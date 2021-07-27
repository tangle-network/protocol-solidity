/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

pragma solidity ^0.8.0;

import "./LinkableERC20AnchorMiMC2.sol";

contract AnchorFactoryMiMC {
  function createAnchor2(
    IVerifier _verifier,
    IHasher _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint32 _chainID,
    IERC20 _token
  ) external {
    new LinkableERC20AnchorMiMC2(
      _verifier,
      _hasher,
      _denomination,
      _merkleTreeHeight,
      _chainID,
      _token
    );
  }

  function create2Anchor2(
    bytes32 _salt,
    IVerifier _verifier,
    IHasher _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint32 _chainID,
    IERC20 _token
  ) external {
    new LinkableERC20AnchorMiMC2{salt: _salt}(
      _verifier,
      _hasher,
      _denomination,
      _merkleTreeHeight,
      _chainID,
      _token
    );
  }
}