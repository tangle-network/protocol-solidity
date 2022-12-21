/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
    @title A contract that can be initialized once and only once
    @author Webb Technologies.
 */
contract Initialized {
	bool public initialized;

	modifier onlyUninitialized() {
		require(!initialized, "Initialized: Already initialized");
		_;
	}

	modifier onlyInitialized() {
		require(initialized, "Initialized: Not initialized");
		_;
	}
}
