/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 
pragma solidity ^0.8.0;

/**
	@title IFixedDepositAnchor interface
	@notice Interface for FixedDepositAnchor contract
	@author Webb Technologies
 */
interface IFixedDepositAnchor {
	/**
		@notice Proof struct with public inputs for the FixedDepositAnchor zero-knowledge circuit.
		@param _roots The merkle roots being used to prove a withdrawal.
		@param _nullifierHash The nullifier hash being exposed to prevent future double-withdrawal.
		@param _extdataHash The external public input data hash passed into the circuit (arbitrary data)
		The values input to ext data hash are represented below in `ExtData`.
	 */	
	struct Proof {
		bytes proof;
		bytes _roots;
		bytes32 _nullifierHash;
		bytes32 _extDataHash;
	}

	/**
		@notice The ExtData struct containing arbitrary data values for the circuit, used primarily in contract.
		@param _refreshCommitment An optional commitment to be re-inserted into the Anchor's merkle tree.
		@param _recipient The recipient of the withdrawn funds.
		@param _relayer The relayer of the withdrawal transaction.
		@param _fee The fee paid to the relayer for relaying the transaction.
		@param _refund The refund paid to the recipient to have non-zero native balance after withdrawal.
	 */
	struct ExtData {
		bytes32 _refreshCommitment;
		address payable _recipient;
		address payable _relayer;
		uint256 _fee;
		uint256 _refund;
	}

	/**
		@notice Deposits a commitment into the FixedDepositAnchor.
		@notice This will insert the commitment into the Anchor's local
		merkle tree and update the root of the tree.
		@param _commitment The commitment to be inserted into the tree.
	 */
	function deposit(bytes32 _commitment) external payable;

	/**
		@notice Withdraws funds from the FixedDepositAnchor using a proof and public inputs.
		@notice This will verify the zero-knowledge proof and store the nullifier hash in the
		Anchor's contract storage to prevent future double-withdrawals.
		@param _proof The zero-knowledge proof for the withdrawal.
		@param _extData The external public inputs for the withdrawal and `_proof`.
	 */
	function withdraw(
		Proof calldata _proof,
		ExtData calldata _extData
	) external payable;

	/**
		@return denomination Returns the FixedDepositAnchor's fixed denomination.
	 */
	function getDenomination() external view returns (uint);

	/**
		@return tokenAddress Returns the FixedDepositAnchor's deposit token address.
	 */
	function getToken() external view returns (address);
}
