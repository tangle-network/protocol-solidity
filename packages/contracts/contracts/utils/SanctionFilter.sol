/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

import "../interfaces/external/chainalysis/ISanctionsList.sol";

pragma solidity ^0.8.18;

/// @title SanctionFilter contract.
/// @notice This contract is used to filter out sanctioned addresses.
/// @notice The hardcoded `SANCTIONS_CONTRACT` only exists on certain chains.
/// Refer to https://go.chainalysis.com/chainalysis-oracle-docs.html for compatible chains.
contract SanctionFilter {
	address constant SANCTIONS_CONTRACT = 0x40C57923924B5c5c5455c48D93317139ADDaC8fb;

	modifier isNotSanctioned(address addr) {
		ISanctionsList sanctionsList = ISanctionsList(SANCTIONS_CONTRACT);
		require(!sanctionsList.isSanctioned(addr), "SanctionFilter: Sanctioned address");
		_;
	}
}
