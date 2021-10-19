/**
 * Copyright 2021 Webb Technologies, Compound Protocol
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../tokens/GovernedTokenWrapper.sol";

contract GTokenWrapperMock is GovernedTokenWrapper {
    /**
     * @notice Construct a new Comp token
     */
    constructor(string memory name, string memory symbol, address governor, uint256 limit)
      GovernedTokenWrapper(name, symbol, governor, limit, true) {}
}