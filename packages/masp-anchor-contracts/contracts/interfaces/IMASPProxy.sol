/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

interface IMASPProxy {
	enum AssetType {
		ERC20,
		ERC721
	}

	struct QueueDepositInfo {
		AssetType assetType;
		address unwrappedToken;
		address wrappedToken;
		uint256 amount;
		uint256 assetID;
		uint256 tokenID;
		bytes32 depositPartialCommitment;
		bytes32 commitment;
		bool isShielded; // true if corresponds to output commitment from transact
		address proxiedMASP;
	}

	function queueRewardSpentTreeCommitment(bytes32 commitment) external;

	function queueRewardUnspentTreeCommitment(address proxiedMASP, bytes32 commitment) external;

	function queueDeposit(QueueDepositInfo memory depositInfo) external payable;
}
