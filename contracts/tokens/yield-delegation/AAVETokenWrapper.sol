/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../../interfaces/tokens/IGovernedTokenWrapper.sol";

abstract contract AAVETokenWrapper is IGovernedTokenWrapper {
    /**
        @notice Deposits all tokens into AAVE
     */
    function depositIntoAAVE() {
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 balance = balanceOf(token, address(this));
            if (balance > 0) {
                IERC20(token).approve(address(aave), balance);
                aave.deposit(token, balance, address(this), 0);
            }
        }
    }
}