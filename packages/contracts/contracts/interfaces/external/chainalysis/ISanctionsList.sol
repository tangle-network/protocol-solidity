/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.5;

interface ISanctionsList {
	function isSanctioned(address addr) external view returns (bool);
}
