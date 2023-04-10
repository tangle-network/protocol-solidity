// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19;

import "../trees/MerkleTree.sol";
import "../hashers/IHasher.sol";

contract MerkleTreePoseidonMock is MerkleTree {
	constructor(uint32 _treeLevels, IHasher _hasher) MerkleTree(_treeLevels, _hasher) {}

	function insert(uint256 _leaf) public {
		_insert(_leaf);
	}
}
