// SPDX-License-Identifier: MIT

pragma solidity ^0.8.5;

import "../interfaces/verifiers/IBatchVerifier.sol";
import "../utils/Initialized.sol";
import "../interfaces/tokens/IMintableERC20.sol";

/// @dev This contract holds a merkle tree of all tornado cash deposit and withdrawal events
contract MultiAssetVAnchorProxy is Initialized {
    bytes32 public depositRoot;
    bytes32 public previousDepositRoot;
    bytes32 public withdrawalRoot;
    bytes32 public previousWithdrawalRoot;

    struct QueueDepositInfo {
        address unwrappedToken; // 0 if ETH
        address wrappedToken;
        uint256 amount;
        uint256 assetID;
        uint256 tokenID;
        bytes32 depositPartialCommitment;
    }

    mapping(uint256 => QueueDepositInfo) public QueueDepositMap;
    uint256 nextQueueDepositIndex;
    uint256 public lastProcessedDepositLeaf;

    // mapping(QueueDepositInfo => uint256) public ReverseQueueDepositMap;

    mapping(uint256 => bytes32) public RewardUnspentTreeCommitmentMap;
    uint256 nextRewardUnspentTreeCommitmentIndex;
    uint256 public lastProcessedRewardTreelLeaf;

    constructor() public {}

    function initialize() public onlyUninitialized {}

    // TODO: Add events

    /// @dev Queue a new deposit data to be inserted into a merkle tree
    function queueFungibleTokenDeposit (QueueDepositInfo memory depositInfo) public payable {
        uint256 amount = depositInfo.amount;
        address depositToken = depositInfo.unwrappedToken;
        if (depositToken == address(0)) {
            require(msg.value == amount, "Invalid deposit amount");
        } else {
            IMintableERC20(depositToken).transferFrom(
                msg.sender,
                address(this),
                uint256(amount)
            );
        }
        QueueDepositMap[nextQueueDepositIndex] = depositInfo;
        // TODO: Emit Event
        nextQueueDepositIndex = nextQueueDepositIndex + 1;
    }

    // TODO: Batch Deposit from Queue
    function batchDepositFungibleTokens() public {
        // Calculate commitment = hash of QueueDepositInfo data
        // Effects
        // Update latestProcessedDepositLeaf
        // Queue reward commitments
        // Interactions
        // Call batchInsert function on MASP
        // Transfer fungible tokens to MASP
    }

    // TODO: Queue Reward Unspent Tree Commitment
    function queueRewardUnspentTreeCommitment (bytes32 rewardUnspentTreeCommitment) public payable {
        RewardUnspentTreeCommitmentMap[nextQueueDepositIndex] = rewardUnspentTreeCommitment;
        // TODO: Emit Event
        nextRewardUnspentTreeCommitmentIndex = nextRewardUnspentTreeCommitmentIndex + 1;
    }

    // TODO: Batch Insert Into Reward Unspent Tree
    // TODO: Same logic for NFTs as for Fungible Tokens
    // TODO: Refund Deposit from Queue

    function blockTimestamp() public view virtual returns (uint256) {
    return block.timestamp;
    }
}