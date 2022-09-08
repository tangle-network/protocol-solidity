/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IAnchorVerifier.sol";
import "../interfaces/ISemaphore.sol";
// TODO: fix this double Edge struct problem. How can I use Semaphore's method and return its own edge?
import { Edge as Edgei } from "../interfaces/LinkableIncrementalBinaryTree.sol";
import "../anchors/AnchorBase.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/** @dev This contract(pool) allows deposit of an arbitrary amount to it, shielded transfer to another registered user inside the pool
 * and withdrawal from the pool. Project utilizes UTXO model to handle users' funds.
 */

abstract contract IdentityVAnchorBase is AnchorBase {
	int256 public constant MAX_EXT_AMOUNT = 2**248;
	uint256 public constant MAX_FEE = 2**248;

	uint256 public groupId;
	uint256 public lastBalance;
	uint256 public minimalWithdrawalAmount;
	uint256 public maximumDepositAmount;
	ISemaphore SemaphoreContract;

	struct ExtData {
		address recipient;
		int256 extAmount;
		address relayer;
		uint256 fee;
		uint256 refund;
		address token;
		bytes encryptedOutput1;
		bytes encryptedOutput2;
	}

	struct Account {
		address owner;
		bytes publicKey;
	}

	event NewCommitment(bytes32 commitment, uint256 index, bytes encryptedOutput);
	event NewNullifier(bytes32 nullifier);
	event PublicKey(address indexed owner, bytes key);

	/**
		@dev The constructor
		@param _verifier the addresses of SNARK verifiers for 2 inputs and 16 inputs
		@param _hasher hasher address for the merkle tree
	*/
	constructor(
		ISemaphore _semaphore,
		IAnchorVerifier _verifier,
		uint8 _levels,
		IPoseidonT3 _hasher,
		address _handler,
		uint8 _maxEdges
	)
		AnchorBase(_handler, _verifier, _hasher, _levels, _maxEdges)
	{
        // getting a random groupId to avoid collision with possibly existing groupIds
        groupId = _hasher.poseidon([block.timestamp, block.timestamp]);
        SemaphoreContract = _semaphore;
        SemaphoreContract.createGroup(groupId, _levels, _handler, _maxEdges);
    }

	function initialize(uint256 _minimalWithdrawalAmount, uint256 _maximumDepositAmount) external initializer {
		proposalNonce = 0;
		_configureMinimalWithdrawalLimit(_minimalWithdrawalAmount);
		_configureMaximumDepositLimit(_maximumDepositAmount);
		super._initialize();
	}

	function register(Account memory _account) public onlyHandler {
		// require(_account.owner == msg.sender, "only owner can be registered");
        uint256 publicKey = abi.decode(_account.publicKey, (uint256));
        SemaphoreContract.addMember(groupId, publicKey);
		_register(_account);
	}

    function getGroupRoot() public returns (uint256) {
        return SemaphoreContract.getRoot(groupId);
    }
    //
    function getGroupLatestNeighborEdges() public returns (Edgei[] memory) {
        return SemaphoreContract.getLatestNeighborEdges(groupId);
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
		emit PublicKey(_account.owner, _account.publicKey);
	}

	/** @dev this function is defined in a child contract */
	//removed payable from address might need to add it back if things don't work
	function _processWithdraw(
		address  _recipient,
		uint256 _minusExtAmount
	) internal virtual;

	/** similar to _processWithdraw. Is defined in a child contract */
	function _processFee(
		address  _relayer,
		uint256 _fee
	) internal virtual;

	function _configureMinimalWithdrawalLimit(uint256 _minimalWithdrawalAmount) internal {
		minimalWithdrawalAmount = _minimalWithdrawalAmount;
	}

	function _configureMaximumDepositLimit(uint256 _maximumDepositAmount) internal {
		maximumDepositAmount = _maximumDepositAmount;
	}

	function verify2(
		bytes memory _proof,
		bytes memory _input
	) internal view returns (bool r) {
		uint256[8] memory p = abi.decode(_proof, (uint256[8]));
		(
				uint256[2] memory a,
				uint256[2][2] memory b,
				uint256[2] memory c
		) = unpackProof(p);
		r = verifier.verifyProof(
			a, b, c,
			_input,
			maxEdges,
			true
		);
		require(r, "Invalid withdraw proof");
		return r;
	}

	function verify16(
		bytes memory _proof,
		bytes memory _input
	) internal view returns (bool r) {
		uint256[8] memory p = abi.decode(_proof, (uint256[8]));
		(
				uint256[2] memory a,
				uint256[2][2] memory b,
				uint256[2] memory c
		) = unpackProof(p);
		r = verifier.verifyProof(
			a, b, c,
			_input,
			maxEdges,
			false
		);
		require(r, "Invalid withdraw proof");
		return r;
	}
}