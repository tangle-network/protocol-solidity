/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/// @title A contract that can be initialized once and only once
/// @author Webb Technologies.
/// @notice This contract tracks nonces for proposal execution.
contract ProposalNonceTracker {
	uint32 public proposalNonce;

	modifier manyIncrementingByOne(uint32[] memory nonces) {
		for (uint256 i = 0; i < nonces.length; i++) {
			require(
				nonces[i] == proposalNonce + 1,
				"ProposalNonceTracker: Nonce must increment by 1"
			);
			proposalNonce = nonces[i];
		}
		_;
	}

	modifier onlyIncrementingByOne(uint32 nonce) {
		require(nonce == proposalNonce + 1, "ProposalNonceTracker: Nonce must increment by 1");
		proposalNonce = nonce;
		_;
	}
}
