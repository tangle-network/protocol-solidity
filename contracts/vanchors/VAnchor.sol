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
    Verifiers memory _verifiers,
    uint32 _levels,
    address _hasher,
    IERC6777 _token,
    address _omniBridge,
    address _l1Unwrapper,
    uint256 _l1ChainId,
    PermissionedAccounts memory _permissions,
    uint8 _maxEdges
  ) LinkableVAnchor(
    _verifiers,
    _levels,
    _hasher,
    _token,
    _omniBridge,
    _l1Unwrapper,
    _l1ChainId,
    _permissions,
    _maxEdges
  ) {}
}
