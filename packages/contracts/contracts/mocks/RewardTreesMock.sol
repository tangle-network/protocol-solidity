// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../anonymity-mining/RewardTrees.sol";
import "../hashers/IHasher.sol";

contract RewardTreesMock is RewardTrees {
	constructor(address _rewardProxy, IHasher _hasher2, IHasher _hasher3, uint32 _treeLevels) RewardTrees(_rewardProxy, _hasher2, _hasher3, _treeLevels) {}
}
