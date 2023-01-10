// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../anonymity-mining/RewardTrees.sol";
import "../hashers/IHasher.sol";

contract RewardTreesMock is RewardTrees {
    uint256 public timestamp;
    uint256 public currentBlock;
	constructor(address _rewardProxy, IHasher _hasher2, IHasher _hasher3, uint32 _treeLevels) RewardTrees(_rewardProxy, _hasher2, _hasher3, _treeLevels) {}
    
    function setBlockNumber(uint256 _blockNumber) public {
        currentBlock = _blockNumber;
    }
    
    function blockNumber() public view override returns (uint256) {
        return currentBlock == 0 ? block.number : currentBlock;
    }
}
