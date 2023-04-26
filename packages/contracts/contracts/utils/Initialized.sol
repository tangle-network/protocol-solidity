/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

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
