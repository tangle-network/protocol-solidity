/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../base/MultiAssetVAnchor.sol";
import "../../trees/BatchUpdatableTree.sol";
import "../../interfaces/verifiers/IBatchVerifier.sol";

contract MultiAssetVAnchorBatchTree is MultiAssetVAnchor, BatchMerkleTree {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;

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
		uint32 _merkleTreeLevels,
		IHasher _hasher,
		address _handler,
        IBatchTreeVerifierSelector _batchTreeVerifier,
		uint8 _maxEdges
	)
		MultiAssetVAnchor(_registry, _verifier, _merkleTreeLevels, _handler, _maxEdges)
		BatchMerkleTree(_merkleTreeLevels, _hasher, _batchTreeVerifier)
	{}

	/// @inheritdoc ZKVAnchorBase
	function _executeInsertions(
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) internal override {
		insertTwo(_publicInputs.outputCommitments[0], _publicInputs.outputCommitments[1]);
		emit NewCommitment(
			_publicInputs.outputCommitments[0],
			0,
			this.getNextIndex() - 2,
			_encryptions.encryptedOutput1
		);
		emit NewCommitment(
			_publicInputs.outputCommitments[1],
			0,
			this.getNextIndex() - 1,
			_encryptions.encryptedOutput2
		);
		for (uint256 i = 0; i < _publicInputs.inputNullifiers.length; i++) {
			emit NewNullifier(_publicInputs.inputNullifiers[i]);
		}
	}
}
