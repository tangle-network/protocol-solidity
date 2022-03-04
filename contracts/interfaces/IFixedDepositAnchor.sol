/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 
pragma solidity ^0.8.0;


interface IFixedDepositAnchor {
	struct Proof {
		bytes proof;
		bytes _roots;
		bytes32 _nullifierHash;
		bytes32 _extDataHash;
	}

	struct ExtData {
		bytes32 _refreshCommitment;
		address payable _recipient;
		address payable _relayer;
		uint256 _fee;
		uint256 _refund;
	}

	function deposit(bytes32 _commitment) external payable;

	function withdraw(
		Proof calldata _proof,
		ExtData calldata _extData
	) external payable;

	function getDenomination() external view returns (uint);

	function getToken() external view returns (address);
}
