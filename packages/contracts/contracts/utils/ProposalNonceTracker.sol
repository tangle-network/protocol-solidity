/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/**
    @title A contract that can be initialized once and only once
    @author Webb Technologies.
 */
contract ProposalNonceTracker {
	uint256 public proposalNonce;

	modifier manyIncrementingByOne(uint32[] memory nonces) {
		for (uint256 i = 0; i < nonces.length; i++) {
			require(proposalNonce < nonces[i], "ProposalNonceTracker: Invalid nonce");
			require(
				nonces[i] <= proposalNonce + 1,
				"ProposalNonceTracker: Nonce must not increment more than 1"
			);
			proposalNonce = nonces[i];
		}
		_;
	}

	modifier onlyIncrementingByOne(uint nonce) {
		require(proposalNonce < nonce, "ProposalNonceTracker: Invalid nonce");
		require(
			nonce <= proposalNonce + 1,
			"ProposalNonceTracker: Nonce must not increment more than 1"
		);
		proposalNonce = nonce;
		_;
	}

	modifier onlyIncrementingByAtMost1048(uint nonce) {
		require(proposalNonce < nonce, "ProposalNonceTracker: Invalid nonce");
		require(
			nonce <= proposalNonce + 1048,
			"ProposalNonceTracker: Nonce must not increment more than 1"
		);
		proposalNonce = nonce;
		_;
	}

	function getProposalNonce() external view returns (uint256) {
		return proposalNonce;
	}
}
