/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../base/MultiAssetVAnchor.sol";
import "../../trees/ProxiedBatchTree.sol";
import "../../interfaces/verifiers/IBatchVerifier.sol";
import "../../interfaces/IMultiAssetVAnchorBatchTree.sol";

contract MultiAssetVAnchorBatchTree is MultiAssetVAnchor, ProxiedBatchTree {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;

	address public rewardUnspentTree;
	address public rewardSpentTree;

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
		// TODO: Queue the output commitments
	}

	function _executeFeeInsertions(
		uint256[2] memory feeOutputCommitments,
		Encryptions memory _feeEncryptions
	) internal override {
		// TODO: Queue the fee output commitments
	}
}