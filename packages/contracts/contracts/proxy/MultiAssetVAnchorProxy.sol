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
    IBatchTreeVerifierSelector public treeUpdateVerifier;

    uint256 public constant CHUNK_TREE_HEIGHT = 8;
    uint256 public constant CHUNK_SIZE = 2**CHUNK_TREE_HEIGHT;
    uint256 public constant ITEM_SIZE = 32 + 20 + 4;
    uint256 public constant BYTES_SIZE = 32 + 32 + 4 + CHUNK_SIZE * ITEM_SIZE;
    uint256 public constant SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

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

    mapping(QueueDepositInfo => uint256) public ReverseQueueDepositMap;

    mapping(uint256 => bytes32) public rewardUnspentTreeCommitmentMap;
    uint256 nextRewardUnspentTreeCommitmentIndex;
    uint256 public lastProcessedRewardTreelLeaf;

    constructor() public {}

    function initialize(IBatchTreeVerifierSelector _treeUpdateVerifier) public onlyUninitialized {
    treeUpdateVerifier = _treeUpdateVerifier;
    }

    // TODO: Add events

    /// @dev Queue a new deposit data to be inserted into a merkle tree
    function queueFungibleTokenDeposit (QueueDepositInfo depositInfo) public payable {
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
    // TODO: Refund Deposit from Queue
    // TODO: Queue Reward Unspent Tree Commitment
    // TODO: Batch Insert Into Reward Unspent Tree
    // TODO: Same logic for NFTs as for Fungible Tokens

    function blockTimestamp() public view virtual returns (uint256) {
    return block.timestamp;
    }
}