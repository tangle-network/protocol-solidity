/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

import "../MultiAssetVAnchor.sol";
import "../trees/ProxiedBatchTree.sol";
import "../interfaces/IBatchVerifier.sol";
import "../interfaces/IMultiAssetVAnchorBatchTree.sol";

/**
	@title MultiAssetVAnchorBatchTree
	@author Webb Technologies
	@notice This contract is a MultiAssetVAnchor that uses a BatchTree to insert
	commitments into the Merkle Tree. This contract uses a proxy contract that
	queues and submits batches deposit commitments into the BatchTree using a
	zero-knowledge proof.
 */
contract MultiAssetVAnchorBatchTree is MultiAssetVAnchor, ProxiedBatchTree {
	using SafeERC20 for IERC20;

	address public rewardUnspentTree;
	address public rewardSpentTree;

	event NewQueuedCommitment(
		uint256 commitment,
		uint256 subTreeIndex,
		uint256 leafIndex,
		bytes encryptedOutput
	);

	/**
		@notice The VAnchorTree constructor
        @param _registry The asset registry address
		@param _verifier The address of SNARK verifier for this contract
		@param _merkleTreeLevels The height/# of levels of underlying Merkle Tree
		@param _hasher The address of hash contract
		@param _handler The address of AnchorHandler for this contract
		@param _maxEdges The maximum number of edges in the LinkableAnchor + Verifier supports.
		@notice The `_maxEdges` is zero-knowledge circuit dependent, meaning the
		`_verifier` ONLY supports a certain maximum # of edges. Therefore we need to
		limit the size of the LinkableAnchor with this parameter.
	*/
	constructor(
		IRegistry _registry,
		IAnchorVerifier _verifier,
		ISwapVerifier _swapVerifier,
		IBatchTreeVerifierSelector _batchTreeVerifier,
		address _handler,
		IHasher _hasher,
		IMASPProxy _proxy,
		IBatchTree _rewardUnspentTree,
		IBatchTree _rewardSpentTree,
		uint32 _merkleTreeLevels,
		uint8 _maxEdges
	)
		MultiAssetVAnchor(
			_registry,
			_proxy,
			_verifier,
			_swapVerifier,
			_merkleTreeLevels,
			_handler,
			_maxEdges
		)
		ProxiedBatchTree(_merkleTreeLevels, _hasher, _batchTreeVerifier, _proxy)
	{
		rewardUnspentTree = address(_rewardUnspentTree);
		rewardSpentTree = address(_rewardSpentTree);
	}

	/// @inheritdoc ZKVAnchorBase
	function _executeInsertions(
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) internal override {
		IMASPProxy.QueueDepositInfo memory depositInfo_0 = IMASPProxy.QueueDepositInfo(
			IMASPProxy.AssetType.ERC20,
			address(0x0),
			address(0x0),
			0,
			0,
			0,
			bytes32(0x0),
			bytes32(_publicInputs.outputCommitments[0]),
			true,
			address(this)
		);
		IMASPProxy(proxy).queueDeposit(depositInfo_0);
		IMASPProxy.QueueDepositInfo memory depositInfo_1 = IMASPProxy.QueueDepositInfo(
			IMASPProxy.AssetType.ERC20,
			address(0x0),
			address(0x0),
			0,
			0,
			0,
			bytes32(0x0),
			bytes32(_publicInputs.outputCommitments[1]),
			true,
			address(this)
		);
		IMASPProxy(proxy).queueDeposit(depositInfo_1);
		emit NewQueuedCommitment(
			_publicInputs.outputCommitments[0],
			0,
			this.getNextIndex() - 2,
			_encryptions.encryptedOutput1
		);
		emit NewQueuedCommitment(
			_publicInputs.outputCommitments[1],
			0,
			this.getNextIndex() - 1,
			_encryptions.encryptedOutput2
		);
		for (uint256 i = 0; i < _publicInputs.inputNullifiers.length; i++) {
			emit NewNullifier(_publicInputs.inputNullifiers[i]);
		}
	}

	function _executeAuxInsertions(
		uint256[2] memory feeOutputCommitments,
		Encryptions memory _feeEncryptions
	) internal override {
		IMASPProxy.QueueDepositInfo memory depositInfo_0 = IMASPProxy.QueueDepositInfo(
			IMASPProxy.AssetType.ERC20,
			address(0x0),
			address(0x0),
			0,
			0,
			0,
			bytes32(0x0),
			bytes32(feeOutputCommitments[0]),
			true,
			address(this)
		);
		IMASPProxy(proxy).queueDeposit(depositInfo_0);
		IMASPProxy.QueueDepositInfo memory depositInfo_1 = IMASPProxy.QueueDepositInfo(
			IMASPProxy.AssetType.ERC20,
			address(0x0),
			address(0x0),
			0,
			0,
			0,
			bytes32(0x0),
			bytes32(feeOutputCommitments[1]),
			true,
			address(this)
		);
		IMASPProxy(proxy).queueDeposit(depositInfo_1);
		emit NewQueuedCommitment(
			feeOutputCommitments[0],
			0,
			this.getNextIndex() - 2,
			_feeEncryptions.encryptedOutput1
		);
		emit NewQueuedCommitment(
			feeOutputCommitments[1],
			0,
			this.getNextIndex() - 1,
			_feeEncryptions.encryptedOutput2
		);
	}
}
