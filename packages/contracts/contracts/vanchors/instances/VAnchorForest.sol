/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.5;

import "../base/VAnchor.sol";
import "../../trees/MerkleForest.sol";

/**
	@title Variable Anchor Forest contract
	@author Webb Technologies
	@notice The Variable Anchor Forest is the same as a VAnchor system but with
	many merkle trees for commitment storage.
 */
contract VAnchorForest is VAnchor, MerkleForest {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;

	/**
		@notice The VAnchor Forest constructor
		@param _verifier The address of SNARK verifier for this contract
		@param _forestLevels The height/# of levels of underlying Merkle Forest
		@param _subtreeLevels The height/# of levels of underlying Merkle Trees in the forest
		@param _hasher The address of hash contract
		@param _handler The address of AnchorHandler for this contract
		@param _token The address of the token that is used to pay the deposit
		@param _maxEdges The maximum number of edges in the LinkableAnchor + Verifier supports.
		@notice The `_maxEdges` is zero-knowledge circuit dependent, meaning the
		`_verifier` ONLY supports a certain maximum # of edges. Therefore we need to
		limit the size of the LinkableAnchor with this parameter.
	*/
	constructor(
		IAnchorVerifier _verifier,
		uint32 _forestLevels,
		uint32 _subtreeLevels,
		IHasher _hasher,
		address _handler,
		address _token,
		uint8 _maxEdges
	)
		VAnchor(_verifier, _forestLevels, _handler, _token, _maxEdges)
		MerkleForest(_forestLevels, _subtreeLevels, _hasher)
	{}

	/// @inheritdoc ZKVAnchorBase
	function _executeInsertions(
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) internal override {
		uint beforeInsertSubtreeIdx = currSubtreeIndex;
		insertTwo(_publicInputs.outputCommitments[0], _publicInputs.outputCommitments[1]);
		uint afterInsertSubtreeIdx = currSubtreeIndex;
		uint leafIndex = numSubtreeElements;
		if (beforeInsertSubtreeIdx != afterInsertSubtreeIdx) {
			afterInsertSubtreeIdx -= 1;
			if (leafIndex <= 1) {
				leafIndex = 2 ** subtreeLevels;
			}
		}
		emit NewCommitment(
			_publicInputs.outputCommitments[0],
			afterInsertSubtreeIdx,
			leafIndex - 2,
			_encryptions.encryptedOutput1
		);
		emit NewCommitment(
			_publicInputs.outputCommitments[1],
			afterInsertSubtreeIdx,
			leafIndex - 1,
			_encryptions.encryptedOutput2
		);
		for (uint256 i = 0; i < _publicInputs.inputNullifiers.length; i++) {
			emit NewNullifier(_publicInputs.inputNullifiers[i]);
		}
	}
}
