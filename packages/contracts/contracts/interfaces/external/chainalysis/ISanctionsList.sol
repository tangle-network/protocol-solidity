/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: Apache 2.0/MIT
 */

pragma solidity ^0.8.5;

interface ISanctionsList {
	function isSanctioned(address addr) external view returns (bool);
}
