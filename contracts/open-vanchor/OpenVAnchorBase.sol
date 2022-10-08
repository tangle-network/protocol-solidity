/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./OpenAnchorBase.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/** @dev This contract(pool) allows deposit of an arbitrary amount to it, shielded transfer to another registered user inside the pool
 * and withdrawal from the pool. Project utilizes UTXO model to handle users' funds.
 */
abstract contract OpenVAnchorBase is OpenAnchorBase {
	int256 public constant MAX_EXT_AMOUNT = 2**248;
	uint256 public constant MAX_FEE = 2**248;

	uint256 public lastBalance;
	uint256 public minimalWithdrawalAmount;
	uint256 public maximumDepositAmount;

	struct Account {
		address owner;
		// A byte array which contains the public key from (0,64) and
   		// the encryption key from (64, 128)
		bytes keyData;
	}

	event NewCommitment(bytes32 commitment, uint256 index);
	event NewNullifier(bytes32 nullifier);
	event PublicKey(address indexed owner, bytes key);

	constructor(
		uint32 _levels,
		IHasher _hasher,
		address _handler
	)
		OpenAnchorBase(_handler, _hasher, _levels)
	{}

	function initialize(uint256 _minimalWithdrawalAmount, uint256 _maximumDepositAmount) external initializer {
		proposalNonce = 0;
		_configureMinimalWithdrawalLimit(_minimalWithdrawalAmount);
		_configureMaximumDepositLimit(_maximumDepositAmount);
		super._initialize();
	}

	function configureMinimalWithdrawalLimit(uint256 _minimalWithdrawalAmount, uint32 _nonce) override public onlyHandler {
		proposalNonce = _nonce;
		_configureMinimalWithdrawalLimit(_minimalWithdrawalAmount);
	}

	function configureMaximumDepositLimit(uint256 _maximumDepositAmount, uint32 _nonce) override public onlyHandler {
		proposalNonce = _nonce;
		_configureMaximumDepositLimit(_maximumDepositAmount);
	}

	/** @dev this function is defined in a child contract */
	//removed payable from address might need to add it back if things don't work
	function _processWithdraw(
		address  _recipient,
		uint256 _minusExtAmount
	) internal virtual;

	function _configureMinimalWithdrawalLimit(uint256 _minimalWithdrawalAmount) internal {
		minimalWithdrawalAmount = _minimalWithdrawalAmount;
	}

	function _configureMaximumDepositLimit(uint256 _maximumDepositAmount) internal {
		maximumDepositAmount = _maximumDepositAmount;
	}
}