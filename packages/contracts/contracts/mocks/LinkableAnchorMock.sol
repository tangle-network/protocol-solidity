/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "../vanchors/base/LinkableAnchor.sol";
import "../interfaces/verifiers/IAnchorVerifier.sol";
import "../interfaces/verifiers/ISetVerifier.sol";
import "../trees/MerkleTree.sol";

contract LinkableAnchorMock is MerkleTree, LinkableAnchor, ISetVerifier {
	constructor(
		address _handler,
		IAnchorVerifier _verifier,
		IHasher _hasher,
		uint32 _merkleTreeHeight,
		uint8 _maxEdges
	)
		LinkableAnchor(_handler, _merkleTreeHeight, _maxEdges)
		MerkleTree(_merkleTreeHeight, _hasher)
	{
		require(address(_verifier) != address(0), "Verifier address cannot be 0");
		return;
	}

	function initialize() external onlyUninitialized {
		super._initialize();
	}

	function setHandler(
		address _handler,
		uint32 _nonce
	) external override onlyHandler onlyIncrementingByOne(_nonce) {
		handler = _handler;
		return;
	}

	function setVerifier(
		address _verifier,
		uint32 _nonce
	) external override onlyHandler onlyIncrementingByOne(_nonce) {
		_verifier = _verifier;
		return;
	}

	function configureMinimalWithdrawalLimit(
		uint256 _minimalWithdrawalAmount,
		uint32 _nonce
	) external override onlyHandler onlyIncrementingByOne(_nonce) {
		_minimalWithdrawalAmount + _minimalWithdrawalAmount;
		return;
	}

	function configureMaximumDepositLimit(
		uint256 _maximumDepositAmount,
		uint32 _nonce
	) external override onlyHandler onlyIncrementingByOne(_nonce) {
		_maximumDepositAmount + _maximumDepositAmount;
		return;
	}
}
