// SPDX-License-Identifier: MIT

pragma solidity ^0.8.5;

import "../interfaces/verifiers/IBatchVerifier.sol";
import "../utils/Initialized.sol";
import "../interfaces/tokens/IMintableERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/tokens/IRegistry.sol";
import "../interfaces/tokens/INftTokenWrapper.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../hashers/IHasher.sol";
import "../interfaces/IMultiAssetVAnchorBatchTree.sol";
import "../interfaces/tokens/ITokenWrapper.sol";
import "../interfaces/tokens/INftTokenWrapper.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "hardhat/console.sol";

/// @dev This contract holds a merkle tree of all tornado cash deposit and withdrawal events
contract MultiAssetVAnchorProxy is Initialized, IERC721Receiver {
	bytes32 public depositRoot;
	bytes32 public previousDepositRoot;
	bytes32 public withdrawalRoot;
	bytes32 public previousWithdrawalRoot;

	struct QueueDepositInfo {
		address unwrappedToken;
		address wrappedToken;
		uint256 amount;
		uint256 assetID;
		uint256 tokenID;
		bytes32 depositPartialCommitment;
		address proxiedMASP;
	}

	mapping(address => mapping(uint256 => QueueDepositInfo)) public QueueERC20DepositMap;
	mapping(address => uint256) public nextQueueERC20DepositIndex;
	uint256 public lastProcessedERC20DepositLeaf;

	mapping(address => mapping(uint256 => QueueDepositInfo)) public QueueERC721DepositMap;
	mapping(address => uint256) public nextQueueERC721DepositIndex;
	uint256 public lastProcessedERC721DepositLeaf;

	mapping(address => mapping(uint256 => bytes32)) public RewardUnspentTreeCommitmentMap;
	mapping(address => uint256) public nextRewardUnspentTreeCommitmentIndex;
	uint256 public lastProcessedRewardUnspentTreeLeaf;

	mapping(address => mapping(uint256 => bytes32)) public RewardSpentTreeCommitmentMap;
	mapping(address => uint256) public nextRewardSpentTreeCommitmentIndex;
	uint256 public lastProcessedRewardSpentTreeLeaf;

	IHasher public hasher;

	mapping(address => bool) public validProxiedMASPs;

	constructor(IHasher _hasher) {
		hasher = _hasher;
	}

	function initialize(
		IMultiAssetVAnchorBatchTree[] memory _validProxiedMASPs
	) public onlyUninitialized {
		for (uint256 i = 0; i < _validProxiedMASPs.length; i++) {
			validProxiedMASPs[address(_validProxiedMASPs[i])] = true;
		}
	}

	// Event for Queueing Deposit
	event QueueDeposit(uint256 indexed depositIndex, address proxiedMASP);
	// Event for Queueing Reward Unspent Tree Commitment
	event QueueRewardUnspentTree(uint256 indexed rewardUnspentTreeIndex, address proxiedMASP);
	// Event for Queueing Reward Spent Tree Commitment
	event QueueRewardSpentTree(uint256 indexed rewardSpentTreeIndex, address proxiedMASP);
	// Event for batch inserting deposits
	event BatchInsertERC20s(
		uint256 indexed lastProcessedDepositLeaf,
		address proxiedMASP,
		bytes32 newRoot
	);
	// Event for batch inserting reward unspent tree commitments
	event BatchInsertRewardUnspentTree(
		uint256 indexed lastProcessedRewardUnspentTreeLeaf,
		address proxiedMASP,
		bytes32 newRoot
	);
	// Event for batch inserting reward spent tree commitments
	event BatchInsertRewardSpentTree(
		uint256 indexed lastProcessedRewardSpentTreeLeaf,
		address proxiedMASP,
		bytes32 newRoot
	);
	// Event for batch inserting NFTs
	event BatchInsertNFTs(
		uint256 indexed lastProcessedNFTLeaf,
		address proxiedMASP,
		bytes32 newRoot
	);

	function queueERC20Deposit(QueueDepositInfo memory depositInfo) public payable {
		require(validProxiedMASPs[depositInfo.proxiedMASP], "Invalid MASP");
		require(
			IRegistry(IMultiAssetVAnchorBatchTree(depositInfo.proxiedMASP).registry())
				.getAssetIdFromWrappedAddress(depositInfo.wrappedToken) != 0,
			"Wrapped asset not registered"
		);
		uint256 amount = depositInfo.amount;
		address depositToken = depositInfo.unwrappedToken;
		IMintableERC20(depositToken).transferFrom(msg.sender, address(this), uint256(amount));
		QueueERC20DepositMap[depositInfo.proxiedMASP][
			nextQueueERC20DepositIndex[depositInfo.proxiedMASP]
		] = depositInfo;
		// Emit Event
		emit QueueDeposit(
			nextQueueERC20DepositIndex[depositInfo.proxiedMASP],
			depositInfo.proxiedMASP
		);
		nextQueueERC20DepositIndex[depositInfo.proxiedMASP] =
			nextQueueERC20DepositIndex[depositInfo.proxiedMASP] +
			1;
	}

	function batchDepositERC20s(
		address proxiedMASP,
		bytes calldata _proof,
		bytes32 _argsHash,
		bytes32 _currentRoot,
		bytes32 _newRoot,
		uint32 _pathIndices,
		uint8 _batchHeight
	) public {
		require(validProxiedMASPs[proxiedMASP], "Invalid MASP");
		// Calculate commitment = hash of QueueDepositInfo data
		uint256 _batchSize = 2 ** _batchHeight;
		bytes32[] memory commitments = new bytes32[](_batchSize);
		uint _lastProcessedERC20DepositLeaf = lastProcessedERC20DepositLeaf;
		require(
			_lastProcessedERC20DepositLeaf + _batchSize <= nextQueueERC20DepositIndex[proxiedMASP],
			"Batch size too big"
		);
		console.log("Batch size: %s", _batchSize);
		console.log("lastProcessedERC20DepositLeaf: %s", _lastProcessedERC20DepositLeaf);
		for (
			uint i = _lastProcessedERC20DepositLeaf;
			i < _lastProcessedERC20DepositLeaf + _batchSize;
			i++
		) {
			QueueDepositInfo memory depositInfo = QueueERC20DepositMap[proxiedMASP][i];
			commitments[i] = bytes32(
				IHasher(hasher).hash4(
					[
						depositInfo.assetID,
						depositInfo.tokenID,
						depositInfo.amount,
						uint256(depositInfo.depositPartialCommitment)
					]
				)
			);
			console.logBytes32(commitments[i]);
			// Queue reward commitments
			queueRewardUnspentTreeCommitment(
				proxiedMASP,
				bytes32(IHasher(hasher).hashLeftRight(uint256(commitments[i]), block.timestamp))
			);
			console.log("Transferring funds batch insert");
			if (depositInfo.unwrappedToken != depositInfo.wrappedToken) {
				console.log("transfer 111");
				IERC20(depositInfo.unwrappedToken).approve(
					address(depositInfo.wrappedToken),
					uint256(depositInfo.amount)
				);
				IMultiAssetVAnchorBatchTree(depositInfo.proxiedMASP)._executeWrapping(
					depositInfo.unwrappedToken,
					depositInfo.wrappedToken,
					depositInfo.amount
				);
			} else {
				console.log("transfer 222");
				IERC20(depositInfo.wrappedToken).transfer(
					address(depositInfo.proxiedMASP),
					uint256(depositInfo.amount)
				);
			}
		}
		console.log("Does it reach here?");
		// Update latestProcessedDepositLeaf
		lastProcessedERC20DepositLeaf = _lastProcessedERC20DepositLeaf + _batchSize;
		// Call batchInsert function on MASP
		
		IMultiAssetVAnchorBatchTree(proxiedMASP).batchInsert(
			_proof,
			_argsHash,
			_currentRoot,
			_newRoot,
			_pathIndices,
			commitments,
			uint32(_batchHeight)
		);
		emit BatchInsertERC20s(lastProcessedERC20DepositLeaf, proxiedMASP, _newRoot);
	}

	function queueRewardUnspentTreeCommitment(
		address proxiedMASP,
		bytes32 rewardUnspentTreeCommitment
	) public payable {
		RewardUnspentTreeCommitmentMap[proxiedMASP][
			nextRewardUnspentTreeCommitmentIndex[proxiedMASP]
		] = rewardUnspentTreeCommitment;
		// Emit Event
		emit QueueRewardUnspentTree(nextRewardUnspentTreeCommitmentIndex[proxiedMASP], proxiedMASP);
		nextRewardUnspentTreeCommitmentIndex[proxiedMASP] =
			nextRewardUnspentTreeCommitmentIndex[proxiedMASP] +
			1;
	}

	function batchInsertRewardUnspentTree(
		address proxiedMASP,
		bytes calldata _proof,
		bytes32 _argsHash,
		bytes32 _currentRoot,
		bytes32 _newRoot,
		uint32 _pathIndices,
		uint8 _batchHeight
	) public {
		// Calculate commitment = hash of QueueDepositInfo data
		require(validProxiedMASPs[proxiedMASP], "Invalid MASP");
		uint256 _batchSize = 2 ** _batchHeight;
		bytes32[] memory commitments = new bytes32[](_batchSize);
		uint _lastProcessedRewardUnspentTreeLeaf = lastProcessedRewardUnspentTreeLeaf;
		require(
			_lastProcessedRewardUnspentTreeLeaf + _batchSize <=
				nextRewardUnspentTreeCommitmentIndex[proxiedMASP],
			"Batch size too big"
		);
		for (
			uint i = _lastProcessedRewardUnspentTreeLeaf;
			i < _lastProcessedRewardUnspentTreeLeaf + _batchSize;
			i++
		) {
			commitments[i] = RewardUnspentTreeCommitmentMap[proxiedMASP][i];
		}
		// Update latestProcessedDepositLeaf
		lastProcessedRewardUnspentTreeLeaf = _lastProcessedRewardUnspentTreeLeaf + _batchSize;
		// Call batchInsert function on MASP
		IBatchTree(IMultiAssetVAnchorBatchTree(proxiedMASP).rewardUnspentTree()).batchInsert(
			_proof,
			_argsHash,
			_currentRoot,
			_newRoot,
			_pathIndices,
			commitments,
			uint32(_batchHeight)
		);
		emit BatchInsertRewardUnspentTree(
			lastProcessedRewardUnspentTreeLeaf,
			proxiedMASP,
			_newRoot
		);
	}

	function queueRewardSpentTreeCommitment(bytes32 rewardSpentTreeCommitment) public payable {
		address proxiedMASP = msg.sender;
		RewardSpentTreeCommitmentMap[proxiedMASP][
			nextRewardSpentTreeCommitmentIndex[proxiedMASP]
		] = rewardSpentTreeCommitment;
		// Emit Event
		emit QueueRewardSpentTree(nextRewardSpentTreeCommitmentIndex[proxiedMASP], proxiedMASP);
		nextRewardSpentTreeCommitmentIndex[proxiedMASP] =
			nextRewardSpentTreeCommitmentIndex[proxiedMASP] +
			1;
	}

	function batchInsertRewardSpentTree(
		address proxiedMASP,
		bytes calldata _proof,
		bytes32 _argsHash,
		bytes32 _currentRoot,
		bytes32 _newRoot,
		uint32 _pathIndices,
		uint8 _batchHeight
	) public {
		// Calculate commitment = hash of QueueDepositInfo data
		require(validProxiedMASPs[proxiedMASP], "Invalid MASP");
		uint256 _batchSize = 2 ** _batchHeight;
		bytes32[] memory commitments = new bytes32[](_batchSize);
		uint _lastProcessedRewardSpentTreeLeaf = lastProcessedRewardSpentTreeLeaf;
		require(
			_lastProcessedRewardSpentTreeLeaf + _batchSize <=
				nextRewardSpentTreeCommitmentIndex[proxiedMASP],
			"Batch size too big"
		);
		for (
			uint i = _lastProcessedRewardSpentTreeLeaf;
			i < _lastProcessedRewardSpentTreeLeaf + _batchSize;
			i++
		) {
			commitments[i] = RewardSpentTreeCommitmentMap[proxiedMASP][i];
		}
		// Update latestProcessedDepositLeaf
		lastProcessedRewardSpentTreeLeaf = _lastProcessedRewardSpentTreeLeaf + _batchSize;
		// Call batchInsert function on MASP
		IBatchTree(IMultiAssetVAnchorBatchTree(proxiedMASP).rewardSpentTree()).batchInsert(
			_proof,
			_argsHash,
			_currentRoot,
			_newRoot,
			_pathIndices,
			commitments,
			_batchHeight
		);
		emit BatchInsertRewardSpentTree(lastProcessedRewardSpentTreeLeaf, proxiedMASP, _newRoot);
	}

	function queueERC721Deposit(QueueDepositInfo memory depositInfo) public payable {
		require(validProxiedMASPs[depositInfo.proxiedMASP], "Invalid MASP");
		require(
			IRegistry(IMultiAssetVAnchorBatchTree(depositInfo.proxiedMASP).registry())
				.getAssetIdFromWrappedAddress(depositInfo.wrappedToken) != 0,
			"Wrapped asset not registered"
		);
		address depositToken = depositInfo.unwrappedToken;
		require(
			IRegistry(IMultiAssetVAnchorBatchTree(depositInfo.proxiedMASP).registry())
				.getUnwrappedAssetAddress(depositInfo.assetID) == depositToken,
			"Wrapped and unwrapped addresses don't match"
		);
		IERC721(depositToken).safeTransferFrom(msg.sender, address(this), depositInfo.tokenID);
		QueueERC721DepositMap[depositInfo.proxiedMASP][
			nextQueueERC721DepositIndex[depositInfo.proxiedMASP]
		] = depositInfo;
		// Emit Event
		emit QueueDeposit(
			nextQueueERC721DepositIndex[depositInfo.proxiedMASP],
			depositInfo.proxiedMASP
		);
		nextQueueERC721DepositIndex[depositInfo.proxiedMASP] =
			nextQueueERC721DepositIndex[depositInfo.proxiedMASP] +
			1;
	}

	function batchDepositERC721s(
		address proxiedMASP,
		bytes calldata _proof,
		bytes32 _argsHash,
		bytes32 _currentRoot,
		bytes32 _newRoot,
		uint32 _pathIndices,
		uint8 _batchHeight
	) public {
		// Calculate commitment = hash of QueueDepositInfo data
		uint256 _batchSize = 2 ** _batchHeight;
		bytes32[] memory commitments = new bytes32[](_batchSize);
		uint _lastProcessedERC721DepositLeaf = lastProcessedERC721DepositLeaf;
		require(
			_lastProcessedERC721DepositLeaf + _batchSize <=
				nextQueueERC721DepositIndex[proxiedMASP],
			"Batch size too big"
		);
		for (
			uint i = _lastProcessedERC721DepositLeaf;
			i < _lastProcessedERC721DepositLeaf + _batchSize;
			i++
		) {
			QueueDepositInfo memory depositInfo = QueueERC721DepositMap[proxiedMASP][i];
			commitments[i] = bytes32(
				hasher.hash4(
					[
						depositInfo.assetID,
						depositInfo.tokenID,
						depositInfo.amount,
						uint256(depositInfo.depositPartialCommitment)
					]
				)
			);
			// Queue reward commitments
			queueRewardUnspentTreeCommitment(
				proxiedMASP,
				bytes32(IHasher(hasher).hashLeftRight(uint256(commitments[i]), block.timestamp))
			);
			if (depositInfo.unwrappedToken != depositInfo.wrappedToken) {
				INftTokenWrapper(depositInfo.wrappedToken).wrap721(
					depositInfo.tokenID,
					depositInfo.unwrappedToken
				);
			} else {
				IERC721(depositInfo.wrappedToken).safeTransferFrom(
					address(this),
					address(depositInfo.proxiedMASP),
					depositInfo.tokenID
				);
			}
		}
		// Update latestProcessedDepositLeaf
		lastProcessedERC721DepositLeaf = _lastProcessedERC721DepositLeaf + _batchSize;
		// Call batchInsert function on MASP
		IMultiAssetVAnchorBatchTree(proxiedMASP).batchInsert(
			_proof,
			_argsHash,
			_currentRoot,
			_newRoot,
			_pathIndices,
			commitments,
			_batchHeight
		);
		emit BatchInsertNFTs(lastProcessedERC721DepositLeaf, proxiedMASP, _newRoot);
	}

	/**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
     *
     * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
		return this.onERC721Received.selector;
	}
}
