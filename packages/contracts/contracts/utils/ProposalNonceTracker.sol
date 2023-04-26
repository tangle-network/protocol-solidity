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
