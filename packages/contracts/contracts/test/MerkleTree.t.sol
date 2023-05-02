/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity >=0.8.19 <0.9.0;

import { PRBTest } from "@prb/test/PRBTest.sol";
import { console2 } from "forge-std/console2.sol";
import { StdCheats } from "forge-std/StdCheats.sol";

import { MerkleTree } from "../trees/MerkleTree";
import { KeccakHasher } from "../hashers/KeccakHasher";

contract MerkleTreeTest is PRBTest, StdCheats {
	IHasher public hasher;
	MerkleTree public tree;

	function setUp() public virtual {
		uint forestLevels = 2;
		uint subtreeLevels = 30;

		hasher = IHasher(new KeccakHasher());
		tree = new MerkleTreeTest(forestLevels, subtreeLevels, hasher);
	}
}
