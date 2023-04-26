/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

/**
    @title Interface for setting the verifier for a contract.
 */
interface ISetVerifier {
	/**
        @notice Sets the verifier for the contract
        @param verifier The new verifier address
        @param nonce The nonce for tracking update counts
     */
	function setVerifier(address verifier, uint32 nonce) external;
}
