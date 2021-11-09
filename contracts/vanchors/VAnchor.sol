/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../interfaces/ITokenWrapper.sol";
import "../interfaces/IMintableERC20.sol";
import "./LinkableVAnchor.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VAnchor is LinkableVAnchor {
  using SafeERC20 for IERC20;

  constructor(
    IVAnchorVerifier _verifier,
    uint32 _levels,
    address _hasher,
    IERC6777 _token,
    PermissionedAccounts memory _permissions,
    uint8 _maxEdges
  ) LinkableVAnchor(
    _verifier,
    _levels,
    _hasher,
    _token,
    _permissions,
    _maxEdges
  ) {}
}
