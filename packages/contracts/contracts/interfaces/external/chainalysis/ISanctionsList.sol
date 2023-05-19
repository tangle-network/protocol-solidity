/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

interface ISanctionsList {
	function isSanctioned(address addr) external view returns (bool);
}
