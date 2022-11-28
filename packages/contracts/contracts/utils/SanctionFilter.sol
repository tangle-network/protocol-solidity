/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

import "../interfaces/external/chainalysis/ISanctionsList.sol";

pragma solidity ^0.8.0;

contract SanctionFilter {
    address constant SANCTIONS_CONTRACT = 0x40C57923924B5c5c5455c48D93317139ADDaC8fb;

    modifier isNotSanctioned(address addr) {
        ISanctionsList sanctionsList = ISanctionsList(SANCTIONS_CONTRACT);
        require(!sanctionsList.isSanctioned(addr), "SanctionFilter: Sanctioned address");
        _;
    }
}
