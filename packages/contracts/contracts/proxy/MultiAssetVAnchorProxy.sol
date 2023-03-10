// SPDX-License-Identifier: MIT

pragma solidity ^0.8.5;

import "../interfaces/verifiers/IBatchVerifier.sol";
import "../utils/Initialized.sol";
import "../interfaces/tokens/IMintableERC20.sol";
import "../interfaces/tokens/IRegistry.sol";
import "../interfaces/tokens/INftTokenWrapper.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../hashers/IHasher.sol";
import "../vanchors/instances/MultiAssetVAnchorBatchUpdatableTree.sol";
import "../interfaces/tokens/ITokenWrapper.sol";
import "../interfaces/tokens/INftTokenWrapper.sol";


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
        address proxiedMASP;
    }

    mapping(uint256 => QueueDepositInfo) public QueueDepositMap;
    uint256 nextQueueDepositIndex;
    uint256 public lastProcessedDepositLeaf;

    // mapping(QueueDepositInfo => uint256) public ReverseQueueDepositMap;

    mapping(uint256 => bytes32) public RewardUnspentTreeCommitmentMap;
    uint256 nextRewardUnspentTreeCommitmentIndex;
    uint256 public lastProcessedRewardUnspentTreelLeaf;

    mapping(uint256 => bytes32) public RewardSpentTreeCommitmentMap;
    uint256 nextRewardSpentTreeCommitmentIndex;
    uint256 public lastProcessedRewardSpentTreelLeaf;

    IHasher public hasher;

    mapping(address => bool) public proxiedMASPs;

    mapping(address => bool) public proxiedRewardTrees;

    constructor(IHasher _hasher) public {
        hasher = _hasher;
    }

    function initialize(IMultiAssetVAnchorBatchTree[] memory _proxiedMASPs, IRewardTrees memory proxiedRewardTrees) public onlyUninitialized {
        for (uint256 i = 0; i < _proxiedMASPs.length; i++) {
            proxiedMASPs[address(_proxiedMASPs[i])] = true;
            proxiedRewardTrees[address(proxiedRewardTrees)] = true;
        }
    }

    // Event for Queueing Deposit
    // Event for Queueing Reward Unspent Tree Commitment
    // Event for Queueing Rewward Spent Tree Commitment
    // Event for Refunding Deposit

    function queueERC20Deposit (QueueDepositInfo memory depositInfo) public payable {
        require(proxiedMASPs[depositInfo.proxiedMASP], "Invalid MASP");
        require(IRegistry(proxiedMASP.registry).getAssetIdFromWrappedAddress(depositInfo.wrappedToken); != 0, "Wrapped asset not registered");
        uint256 amount = depositInfo.amount;
        address depositToken = depositInfo.unwrappedToken;
        IMintableERC20(depositToken).transferFrom(
            msg.sender,
            address(this),
            uint256(amount)
        );
        QueueDepositMap[nextQueueDepositIndex] = depositInfo;
        // TODO: Emit Event
        nextQueueDepositIndex = nextQueueDepositIndex + 1;
    }

    function batchDepositERC20s(bytes32 _argsHash, bytes32 _currentRoot, bytes32 _newRoot, uint32 _pathIndices, uint8 _batchHeight) public {
        // Calculate commitment = hash of QueueDepositInfo data
        uint256 _batchSize = 2 ** _batchHeight;
        bytes32[] memory commitments = new bytes32[](_batchSize);
        uint _lastProcessedDepositLeaf = lastProcessedDepositLeaf;
        for (uint i = _lastProcessedDepositLeaf; i < _lastProcessedDepositLeaf + _batchSize; i++) {
            QueueDepositInfo memory depositInfo = QueueDepositMap[i];
            commitments[i] = bytes32(IHasher(hasher).hash4([
                depositInfo.assetID,
                depositInfo.tokenID,
                depositInfo.amount,
                uint256(depositInfo.depositPartialCommitment)
            ]));
            // Queue reward commitments
            queueRewardUnspentTreeCommitment(bytes32(IHasher(hasher).hashLeftRight(uint256(commitments[i]), block.timestamp)));
            if (depositInfo.unwrappedToken != depositInfo.wrappedToken) {
			    IMultiAssetVAnchorBatchTree(depositInfo.proxiedMASP)._executeWrapping(depositInfo.unwrappedToken, depositInfo.wrappedToken, depositInfo.amount);
		    } else {
                IMintableERC20(depositInfo.wrappedToken).transferFrom(
                    address(this),
                    address(depositInfo.proxiedMASP),
                    uint256(amount)
                );
		    }
        } 
        // Update latestProcessedDepositLeaf
        lastProcessedDepositLeaf = _lastProcessedDepositLeaf + _batchSize;
        // Call batchInsert function on MASP
        IMultiAssetVAnchorBatchTree(proxiedMASP).batchInsert(_argsHash, _currentRoot, _newRoot, _pathIndices, _batchHeight, commitments);
    }

    function queueRewardUnspentTreeCommitment (bytes32 rewardUnspentTreeCommitment) public payable {
        RewardUnspentTreeCommitmentMap[nextQueueDepositIndex] = rewardUnspentTreeCommitment;
        // TODO: Emit Event
        nextRewardUnspentTreeCommitmentIndex = nextRewardUnspentTreeCommitmentIndex + 1;
    }

    function batchInsertRewardUnspentTree(IRewardTrees proxiedRewardTree, bytes32 _argsHash, bytes32 _currentRoot, bytes32 _newRoot, uint32 _pathIndices, uint8 _batchHeight) public {
        // Calculate commitment = hash of QueueDepositInfo data
        require(proxiedRewardTrees[address(proxiedRewardTree)], "Invalid Reward Tree");
        uint256 _batchSize = 2 ** _batchHeight;
        bytes32[] memory commitments = new bytes32[](_batchSize);
        uint _lastProcessedRewardUnspentTreeLeaf = lastProcessedRewardUnspentTreeLeaf;
        for (uint i = _lastProcessedRewardUnspentTreeLeaf; i < _lastProcessedRewardUnspentTreeLeaf + _batchSize; i++) {
            commitments[i] = RewardUnspentTreeCommitmentMap[i];
        } 
        // Update latestProcessedDepositLeaf
        lastProcessedRewardUnspentTreeLeaf = _lastProcessedRewardUnspentTreeLeaf + _batchSize;
        // Call batchInsert function on MASP
        proxiedRewardTree.batchInsertUnspentTree(_argsHash, _currentRoot, _newRoot, _pathIndices, _batchHeight, commitments);
    }

    function queueRewardSpentTreeCommitment (bytes32 rewardSpentTreeCommitment) public payable {
        RewardSpentTreeCommitmentMap[nextQueueDepositIndex] = rewardSpentTreeCommitment;
        // TODO: Emit Event
        nextRewardSpentTreeCommitmentIndex = nextRewardSpentTreeCommitmentIndex + 1;
    }

    function batchInsertRewardSpentTree(address proxiedRewardTree, bytes32 _argsHash, bytes32 _currentRoot, bytes32 _newRoot, uint32 _pathIndices, uint8 _batchHeight) public {
        // Calculate commitment = hash of QueueDepositInfo data
        require(proxiedRewardTree.masp == msg.sender, "Invalid Reward Tree");
        require(proxiedRewardTrees[address(proxiedRewardTree)], "Invalid Reward Tree");
        require(proxiedMASP[msg.sender], "Invalid MASP");
        uint256 _batchSize = 2 ** _batchHeight;
        bytes32[] memory commitments = new bytes32[](_batchSize);
        uint _lastProcessedRewardSpentTreeLeaf = lastProcessedRewardSpentTreeLeaf;
        for (uint i = _lastProcessedRewardSpentTreeLeaf; i < _lastProcessedRewardSpentTreeLeaf + _batchSize; i++) {
            commitments[i] = RewardSpentTreeCommitmentMap[i];
        } 
        // Update latestProcessedDepositLeaf
        lastProcessedRewardSpentTreeLeaf = _lastProcessedRewardSpentTreeLeaf + _batchSize;
        // Call batchInsert function on MASP
        proxiedRewardTree.batchInsertSpentTree(_argsHash, _currentRoot, _newRoot, _pathIndices, _batchHeight, commitments);
    }

    function queueERC721Deposit (QueueDepositInfo memory depositInfo) public payable {
        require(proxiedMASPs[depositInfo.proxiedMASP], "Invalid MASP");
        require(IRegistry(proxiedMASP.registry).getAssetIdFromWrappedAddress(depositInfo.wrappedToken); != 0, "Wrapped asset not registered");
        address depositToken = depositInfo.unwrappedToken;
        require(
            IRegistry(proxiedMASP.registry).getUnwrappedAssetAddress(assetID) == depositToken,
            "Wrapped and unwrapped addresses don't match"
        );x
        uint256 amount = depositInfo.amount;
        IERC721(depositToken).safeTransferFrom(msg.sender, address(this), depositInfo.tokenID);
        QueueDepositMap[nextQueueDepositIndex] = depositInfo;
        // TODO: Emit Event
        nextQueueDepositIndex = nextQueueDepositIndex + 1;
    }

    function batchDepositERC721s(bytes32 _argsHash, bytes32 _currentRoot, bytes32 _newRoot, uint32 _pathIndices, uint8 _batchHeight) public {
        // Calculate commitment = hash of QueueDepositInfo data
        uint256 _batchSize = 2 ** _batchHeight;
        bytes32[] memory commitments = new bytes32[](_batchSize);
        uint _lastProcessedDepositLeaf = lastProcessedDepositLeaf;
        for (uint i = _lastProcessedDepositLeaf; i < _lastProcessedDepositLeaf + _batchSize; i++) {
            QueueDepositInfo memory depositInfo = QueueDepositMap[i];
            commitments[i] = bytes32(IHasher(hasher).hash4([
                depositInfo.assetID,
                depositInfo.tokenID,
                depositInfo.amount,
                uint256(depositInfo.depositPartialCommitment)
            ]));
            // Queue reward commitments
            queueRewardUnspentTreeCommitment(bytes32(IHasher(hasher).hashLeftRight(uint256(commitments[i]), block.timestamp)));
            if (depositInfo.unwrappedToken != depositInfo.wrappedToken) {
			    INftTokenWrapper(depositInfo.wrappedToken).wrap721(depositInfo.tokenID, depositInfo.unwrappedToken);
		    } else {
			    IERC721(depositInfo.wrappedToken).safeTransferFrom(address(this), address(depositInfo.proxiedMASP), depositInfo.tokenID);
		    }
        } 
        // Update latestProcessedDepositLeaf
        lastProcessedDepositLeaf = _lastProcessedDepositLeaf + _batchSize;
        // Call batchInsert function on MASP
        IMultiAssetVAnchorBatchTree(proxiedMASP).batchInsert(_argsHash, _currentRoot, _newRoot, _pathIndices, _batchHeight, commitments);
    }
}

// Overall TODOs
// 1. Add events
// 3. Add Registry Checking
// 4. Trigger spent tree Queuing upon MASP withdraw
// 5. Refund logic
// 6. Interfaces for MASP and Reward Tree
