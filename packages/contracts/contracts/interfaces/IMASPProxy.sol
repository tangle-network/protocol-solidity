/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.5;

interface IMASPProxy {
	function queueRewardSpentTreeCommitment(bytes32 commitment) external;

	function queueRewardUnspentTreeCommitment(address proxiedMASP, bytes32 commitment) external;
}
