/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "../instances/VAnchorTree.sol";
import "../../utils/SanctionFilter.sol";

/**
	@title Chainalysis Variable Anchor contract
	@author Webb Technologies
	@notice The main addition here is a filter for sanctioned addresses on transactions.
 */
contract ChainalysisVAnchor is VAnchorTree, SanctionFilter {
	using SafeERC20 for IERC20;

	constructor(
		IAnchorVerifier _verifier,
		uint32 _merkleTreeLevels,
		IHasher _hasher,
		address _handler,
		address _token,
		uint8 _maxEdges
	) VAnchorTree(_verifier, _merkleTreeLevels, _hasher, _handler, _token, _maxEdges) {}

	/// @inheritdoc ZKVAnchorBase
	function registerAndTransact(
		Account memory _account,
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) public payable override isNotSanctioned(msg.sender) isNotSanctioned(_externalData.recipient) {
		super.registerAndTransact(
			_account,
			_proof,
			_auxPublicInputs,
			_externalData,
			_publicInputs,
			_encryptions
		);
	}

	/// @inheritdoc ZKVAnchorBase
	function transact(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	)
		public
		payable
		override
		nonReentrant
		isNotSanctioned(msg.sender)
		isNotSanctioned(_externalData.recipient)
	{
		super.transact(_proof, _auxPublicInputs, _externalData, _publicInputs, _encryptions);
	}
}
