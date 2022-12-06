/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../base/VAnchor.sol";
import "../../utils/SanctionFilter.sol";

/**
	@title Chainalysis Variable Anchor contract
	@author Webb Technologies
	@notice The main addition here is a filter for sanctioned addresses on transactions.
 */
abstract contract ChainalysisVAnchor is VAnchor, SanctionFilter {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;
	
	constructor(
		IAnchorVerifier _verifier,
		uint32 _levels,
		address _handler,
		address _token,
		uint8 _maxEdges
	)
		VAnchor(_verifier, _levels, _handler, _token, _maxEdges)
	{}

	/// @inheritdoc ZKVAnchorBase
	function registerAndTransact(
		Account memory _account,
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	)
		override
		public
		payable
		isNotSanctioned(msg.sender)
		isNotSanctioned(_externalData.recipient)
	{
		super.registerAndTransact(_account, _proof, _auxPublicInputs, _externalData, _publicInputs, _encryptions);
	}

	/// @inheritdoc ZKVAnchorBase
	function transact(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	)
		override
		public
		payable
		nonReentrant
		isNotSanctioned(msg.sender)
		isNotSanctioned(_externalData.recipient)
	{
		super.transact(_proof, _auxPublicInputs, _externalData, _publicInputs, _encryptions);
	}
}
