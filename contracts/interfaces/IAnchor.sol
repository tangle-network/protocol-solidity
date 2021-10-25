/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 
pragma solidity ^0.8.0;


interface IAnchor {

	struct PublicInputs {
		bytes _roots;
		bytes32 _nullifierHash;
		bytes32 _refreshCommitment;
		address payable _recipient;
		address payable _relayer;
		uint256 _fee;
		uint256 _refund;
	}

	function deposit(bytes32 _commitment) external payable;

	function withdraw(
		bytes calldata _proof,
		PublicInputs calldata _publicInputs
	) external payable;

	function getDenomination() external view returns (uint);

	function getToken() external view returns (address);
}
