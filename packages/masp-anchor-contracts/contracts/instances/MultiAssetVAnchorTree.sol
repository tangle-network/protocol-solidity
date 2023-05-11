/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

import "@webb-tools/protocol-solidity/trees/MerkleTree.sol";
import "../MultiAssetVAnchor.sol";

/**
	@title Multi Asset Shielded Pool VAnchor contract
	@author Webb Technologies
	@notice The Multi Asset Shielded Pool VAnchor contract is a VAnchor contract
	that supports multiple assets. It uses a Merkle Tree to store the commitments
	and nullifiers.
 */
contract MultiAssetVAnchorTree is MultiAssetVAnchor, MerkleTree {
	using SafeERC20 for IERC20;

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
		IMASPProxy _proxy,
		IAnchorVerifier _verifier,
		ISwapVerifier _swapVerifier,
		uint32 _merkleTreeLevels,
		IHasher _hasher,
		address _handler,
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
		MerkleTree(_merkleTreeLevels, _hasher)
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

	function _executeAuxInsertions(
		uint256[2] memory feeOutputCommitments,
		Encryptions memory _feeEncryptions
	) internal override {
		insertTwo(feeOutputCommitments[0], feeOutputCommitments[1]);
		emit NewCommitment(
			feeOutputCommitments[0],
			0,
			this.getNextIndex() - 2,
			_feeEncryptions.encryptedOutput1
		);
		emit NewCommitment(
			feeOutputCommitments[1],
			0,
			this.getNextIndex() - 1,
			_feeEncryptions.encryptedOutput2
		);
	}
}
