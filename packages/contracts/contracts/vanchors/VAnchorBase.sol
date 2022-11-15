/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../anchors/AnchorBase.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/** @dev This contract(pool) allows deposit of an arbitrary amount to it, shielded transfer to another registered user inside the pool
 * and withdrawal from the pool. Project utilizes UTXO model to handle users' funds.
 */
abstract contract VAnchorBase is AnchorBase {
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

	event NewCommitment(bytes32 commitment, uint256 index, bytes encryptedOutput);
	event NewNullifier(bytes32 nullifier);
	event PublicKey(address indexed owner, bytes key);

	/**
		@dev The constructor
		@param _levels The number of levels in the merkle tree
		@param _hasher hasher address for the merkle tree
		@param _handler handler address for the merkle tree
		@param _maxEdges The maximum number of edges for the linked anchor
	*/
	constructor(
		uint32 _levels,
		IHasher _hasher,
		address _handler,
		uint8 _maxEdges
	)
		AnchorBase(_handler, _hasher, _levels, _maxEdges)
	{}

	function initialize(uint256 _minimalWithdrawalAmount, uint256 _maximumDepositAmount) external initializer {
		super._initialize();
		proposalNonce = 0;
		_configureMinimalWithdrawalLimit(_minimalWithdrawalAmount);
		_configureMaximumDepositLimit(_maximumDepositAmount);

	}

	function register(Account memory _account) public {
		require(_account.owner == msg.sender, "only owner can be registered");
		_register(_account);
	}

	function configureMinimalWithdrawalLimit(uint256 _minimalWithdrawalAmount, uint32 _nonce) override public onlyHandler {
		proposalNonce = _nonce;
		_configureMinimalWithdrawalLimit(_minimalWithdrawalAmount);
	}

	function configureMaximumDepositLimit(uint256 _maximumDepositAmount, uint32 _nonce) override public onlyHandler {
		proposalNonce = _nonce;
		_configureMaximumDepositLimit(_maximumDepositAmount);
	}

	function calculatePublicAmount(int256 _extAmount, uint256 _fee) public pure returns (uint256) {
		require(_fee < MAX_FEE, "Invalid fee");
		require(_extAmount > -MAX_EXT_AMOUNT && _extAmount < MAX_EXT_AMOUNT, "Invalid ext amount");
		int256 publicAmount = _extAmount - int256(_fee);
		return (publicAmount >= 0) ? uint256(publicAmount) : FIELD_SIZE - uint256(-publicAmount);
	}

	function _register(Account memory _account) internal {
		emit PublicKey(_account.owner, _account.keyData);
	}

	/** @dev this function is defined in a child contract */
	//removed payable from address might need to add it back if things don't work
	function _processWithdraw(
		address _token,
		address _recipient,
		uint256 _minusExtAmount
	) internal virtual;

	/** similar to _processWithdraw. Is defined in a child contract */
	function _processFee(
		address _token,
		address _relayer,
		uint256 _fee
	) internal virtual;

	function _configureMinimalWithdrawalLimit(uint256 _minimalWithdrawalAmount) internal {
		minimalWithdrawalAmount = _minimalWithdrawalAmount;
	}

	function _configureMaximumDepositLimit(uint256 _maximumDepositAmount) internal {
		maximumDepositAmount = _maximumDepositAmount;
	}
}