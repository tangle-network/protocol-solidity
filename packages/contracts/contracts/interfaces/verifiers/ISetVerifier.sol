/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

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