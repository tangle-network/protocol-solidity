/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity >=0.8.19 <0.9.0;

import { PRBTest } from "@prb/test/PRBTest.sol";
import { console2 } from "forge-std/console2.sol";
import { StdCheats } from "forge-std/StdCheats.sol";

import { MerkleForest } from "../trees/MerkleForest";
import { KeccakHasher } from "../hashers/KeccakHasher";

contract MerkleForestTest is PRBTest, StdCheats {
	IHasher public hasher;
	MerkleForest public forest;

	function setUp() public virtual {
		uint forestLevels = 2;
		uint subtreeLevels = 30;

		hasher = IHasher(new KeccakHasher());
		forest = new MerkleForestTest(forestLevels, subtreeLevels, hasher);
	}
}
