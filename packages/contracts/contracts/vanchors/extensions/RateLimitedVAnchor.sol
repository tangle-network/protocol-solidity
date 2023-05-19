/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "../instances/VAnchorTree.sol";

/**
	@title Rate Limited Variable Anchor contract
	@author Webb Technologies
	@notice The main addition here is a rate limiter on the amount that can be withdrawn
	in a single day. This is to prevent a single user from withdrawing all of the funds
	in the pool in a single day.
 */
contract RateLimitedVAnchor is VAnchorTree {
	using SafeERC20 for IERC20;

	uint256 public DAILY_WITHDRAWAL_LIMIT = 1_000_000 * 10 ** 18;
	uint256 public currentDailyWithdrawal = 0;
	uint256 public startTime = 0;

	constructor(
		IAnchorVerifier _verifier,
		uint32 _merkleTreeLevels,
		IHasher _hasher,
		address _handler,
		address _token,
		uint8 _maxEdges
	) VAnchorTree(_verifier, _merkleTreeLevels, _hasher, _handler, _token, _maxEdges) {
		startTime = block.timestamp;
	}

	/// Set the daily withdrawal limit
	/// @param _limit The new limit
	/// @param _nonce The nonce of the proposal
	function setDailyWithdrawalLimit(
		uint256 _limit,
		uint256 _nonce
	) external onlyHandler onlyIncrementingByOne(_nonce) {
		DAILY_WITHDRAWAL_LIMIT = _limit;
		proposalNonce = _nonce;
	}

	/// @inheritdoc ZKVAnchorBase
	function transact(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) public payable override nonReentrant {
		// If we are in the current day, continue to add to the currentDailyWithdrawal
		if (block.timestamp < startTime + 1 days) {
			currentDailyWithdrawal = (_externalData.extAmount < 0)
				? currentDailyWithdrawal + uint256(-_externalData.extAmount)
				: currentDailyWithdrawal;
		} else {
			// If we are in a new day, reset the currentDailyWithdrawal and set the new startTime
			currentDailyWithdrawal = (_externalData.extAmount < 0)
				? uint256(-_externalData.extAmount)
				: 0;
			startTime = startTime + 1 days;
		}
		// Ensure the currentDailyWithdrawal is less than the DAILY_WITHDRAWAL_LIMIT, revert.
		require(
			currentDailyWithdrawal <= DAILY_WITHDRAWAL_LIMIT,
			"RateLimitedVAnchor: Daily withdrawal limit reached"
		);

		super.transact(_proof, _auxPublicInputs, _externalData, _publicInputs, _encryptions);
	}
}
