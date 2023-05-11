// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@webb-tools/protocol-solidity/interfaces/tokens/ITokenWrapper.sol";
import "@webb-tools/protocol-solidity/hashers/IHasher.sol";
import "@webb-tools/protocol-solidity/utils/Initialized.sol";
import "../interfaces/IBatchVerifier.sol";
import "../interfaces/IRegistry.sol";
import "../interfaces/INftTokenWrapper.sol";
import "../interfaces/IMultiAssetVAnchorBatchTree.sol";
import "../interfaces/INftTokenWrapper.sol";
import "../interfaces/IMASPProxy.sol";

/// @dev This contract holds a merkle tree of all tornado cash deposit and withdrawal events
contract MultiAssetVAnchorProxy is IMASPProxy, Initialized, IERC721Receiver {
	using SafeERC20 for IERC20;

	bytes32 public depositRoot;
	bytes32 public previousDepositRoot;
	bytes32 public withdrawalRoot;
	bytes32 public previousWithdrawalRoot;

	mapping(address => mapping(uint256 => QueueDepositInfo)) public QueueDepositMap;
	mapping(address => uint256) public nextQueueDepositIndex;
	uint256 public lastProcessedDepositLeaf;

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
	event BatchInsertDeposits(
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

	function queueDeposit(QueueDepositInfo memory depositInfo) public payable override {
		address proxiedMASP = depositInfo.proxiedMASP;
		require(validProxiedMASPs[proxiedMASP], "Invalid MASP");
		if (msg.sender != proxiedMASP) {
			// Not an output commitment from transact so need to transfer tokens to MASP
			require(
				depositInfo.isShielded == false,
				"Not an output commitment, isShielded should be false"
			);
			require(
				IRegistry(IMultiAssetVAnchorBatchTree(proxiedMASP).registry())
					.getAssetIdFromWrappedAddress(depositInfo.wrappedToken) != 0,
				"Wrapped asset not registered"
			);
			uint256 amount = depositInfo.amount;
			address depositToken = depositInfo.unwrappedToken;
			// Check deposit commitment is correct
			require(
				depositInfo.commitment ==
					bytes32(
						IHasher(hasher).hash4(
							[
								depositInfo.assetID,
								depositInfo.tokenID,
								depositInfo.amount,
								uint256(depositInfo.depositPartialCommitment)
							]
						)
					),
				"Commitment Hash is wrong"
			);
			// Transfer tokens to MASP
			if (depositInfo.assetType == AssetType.ERC20) {
				IERC20(depositToken).safeTransferFrom(msg.sender, address(this), uint256(amount));
			} else {
				IERC721(depositToken).safeTransferFrom(
					msg.sender,
					address(this),
					depositInfo.tokenID
				);
			}
		}
		QueueDepositMap[proxiedMASP][nextQueueDepositIndex[proxiedMASP]] = depositInfo;
		// Emit Event
		emit QueueDeposit(nextQueueDepositIndex[proxiedMASP], proxiedMASP);
		nextQueueDepositIndex[proxiedMASP] = nextQueueDepositIndex[proxiedMASP] + 1;
	}

	function batchInsertDeposits(
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
		uint _lastProcessedDepositLeaf = lastProcessedDepositLeaf;
		require(
			_lastProcessedDepositLeaf + _batchSize <= nextQueueDepositIndex[proxiedMASP],
			"Batch size too big"
		);
		for (uint i = _lastProcessedDepositLeaf; i < _lastProcessedDepositLeaf + _batchSize; i++) {
			QueueDepositInfo memory depositInfo = QueueDepositMap[proxiedMASP][i];
			uint256 commitmentIndex = i - _lastProcessedDepositLeaf;
			commitments[commitmentIndex] = depositInfo.commitment;
			// Queue reward commitments
			queueRewardUnspentTreeCommitment(
				proxiedMASP,
				bytes32(
					IHasher(hasher).hashLeftRight(
						uint256(commitments[commitmentIndex]),
						block.timestamp
					)
				)
			);
			if (!depositInfo.isShielded) {
				if (depositInfo.assetType == AssetType.ERC20) {
					if (depositInfo.unwrappedToken != depositInfo.wrappedToken) {
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
						IERC20(depositInfo.wrappedToken).transfer(
							address(depositInfo.proxiedMASP),
							uint256(depositInfo.amount)
						);
					}
				} else {
					if (depositInfo.unwrappedToken != depositInfo.wrappedToken) {
						IERC721(depositInfo.unwrappedToken).approve(
							address(depositInfo.wrappedToken),
							depositInfo.tokenID
						);
						INftTokenWrapper(depositInfo.wrappedToken).wrap721(
							address(depositInfo.proxiedMASP),
							depositInfo.tokenID
						);
					} else {
						IERC721(depositInfo.unwrappedToken).approve(
							address(depositInfo.wrappedToken),
							depositInfo.tokenID
						);
						IERC721(depositInfo.wrappedToken).safeTransferFrom(
							address(this),
							address(depositInfo.proxiedMASP),
							depositInfo.tokenID
						);
					}
				}
			}
		}
		// Update latestProcessedDepositLeaf
		lastProcessedDepositLeaf = _lastProcessedDepositLeaf + _batchSize;
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
		emit BatchInsertDeposits(lastProcessedDepositLeaf, proxiedMASP, _newRoot);
	}

	function queueRewardUnspentTreeCommitment(
		address proxiedMASP,
		bytes32 rewardUnspentTreeCommitment
	) public override {
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
			commitments[i - _lastProcessedRewardUnspentTreeLeaf] = RewardUnspentTreeCommitmentMap[
				proxiedMASP
			][i];
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

	function queueRewardSpentTreeCommitment(bytes32 rewardSpentTreeCommitment) public override {
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
			commitments[i - _lastProcessedRewardSpentTreeLeaf] = RewardSpentTreeCommitmentMap[
				proxiedMASP
			][i];
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
