/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./LinkableAnchor.sol";
import "../../structs/PublicInputs.sol";
import "../../interfaces/tokens/IMintableERC20.sol";
import "../../interfaces/tokens/ITokenWrapper.sol";

/** @dev This contract(pool) allows deposit of an arbitrary amount to it, shielded transfer to another registered user inside the pool
 * and withdrawal from the pool. Project utilizes UTXO model to handle users' funds.
 */
abstract contract VAnchorBase is LinkableAnchor {
	using SafeERC20 for IERC20;

	int256 public constant MAX_EXT_AMOUNT = 2 ** 248;
	uint256 public constant MAX_FEE = 2 ** 248;

	uint256 public lastBalance;
	uint256 public minimalWithdrawalAmount;
	uint256 public maximumDepositAmount;

	struct Account {
		address owner;
		// A byte array which contains the public key from (0,64) and
		// the encryption key from (64, 128)
		bytes keyData;
	}

	event NewCommitment(
		uint256 commitment,
		uint256 subTreeIndex,
		uint256 leafIndex,
		bytes encryptedOutput
	);
	event NewNullifier(uint256 nullifier);
	event PublicKey(address indexed owner, bytes key);

	/**
		@dev The constructor
		@param _levels The number of levels in the merkle tree
		@param _handler handler address for the merkle tree
		@param _maxEdges The maximum number of edges for the linked anchor
	*/
	constructor(
		uint32 _levels,
		address _handler,
		uint8 _maxEdges
	) LinkableAnchor(_handler, _levels, _maxEdges) {}

	function initialize(
		uint256 _minimalWithdrawalAmount,
		uint256 _maximumDepositAmount
	) external onlyUninitialized {
		super._initialize();
		_configureMinimalWithdrawalLimit(_minimalWithdrawalAmount);
		_configureMaximumDepositLimit(_maximumDepositAmount);
	}

	function register(Account memory _account) public {
		require(_account.owner == msg.sender, "only owner can be registered");
		_register(_account);
	}

	function configureMinimalWithdrawalLimit(
		uint256 _minimalWithdrawalAmount,
		uint32 _nonce
	) public override onlyHandler onlyIncrementingByOne(_nonce) onlyInitialized {
		_configureMinimalWithdrawalLimit(_minimalWithdrawalAmount);
	}

	function configureMaximumDepositLimit(
		uint256 _maximumDepositAmount,
		uint32 _nonce
	) public override onlyHandler onlyIncrementingByOne(_nonce) onlyInitialized {
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

	function _configureMinimalWithdrawalLimit(uint256 _minimalWithdrawalAmount) internal {
		minimalWithdrawalAmount = _minimalWithdrawalAmount;
	}

	function _configureMaximumDepositLimit(uint256 _maximumDepositAmount) internal {
		maximumDepositAmount = _maximumDepositAmount;
	}

	/**
        @notice Inserts a commitment into the tree
        @notice This is an internal function and meant to be used by a child contract.
        @param _commitment The note commitment = Poseidon(chainId, nullifier, secret)
        @return uint32 The index of the inserted commitment
    */
	function insert(uint256 _commitment) internal returns (uint32) {
		require(!commitments[_commitment], "The commitment has been submitted");

		uint32 insertedIndex = _insert(_commitment);
		commitments[_commitment] = true;
		emit Insertion(_commitment, insertedIndex, block.timestamp, this.getLastRoot());

		return insertedIndex;
	}

	/**
        @notice Inserts two commitments into the tree. Useful for contracts
        that need to insert two commitments at once.
        @notice This is an internal function and meant to be used by a child contract.
        @param _firstCommitment The first note commitment
        @param _secondCommitment The second note commitment
        @return uint32 The index of the first inserted commitment
     */
	function insertTwo(
		uint256 _firstCommitment,
		uint256 _secondCommitment
	) internal returns (uint32) {
		require(!commitments[_firstCommitment], "The commitment has been submitted");
		require(!commitments[_secondCommitment], "The commitment has been submitted");

		uint32 insertedIndex = _insertTwo([_firstCommitment, _secondCommitment]);
		commitments[_firstCommitment] = true;
		commitments[_secondCommitment] = true;
		emit Insertion(_firstCommitment, insertedIndex, block.timestamp, this.getLastRoot());
		emit Insertion(_secondCommitment, insertedIndex + 1, block.timestamp, this.getLastRoot());

		return insertedIndex;
	}

	/**
		@notice Wraps a token for the `msg.sender`
		@param _fromTokenAddress The address of the token to wrap from
		@param _toTokenAddress The address of the token to wrap into
		@param _extAmount The external amount for the transaction
	 */
	function _executeWrapping(
		address _fromTokenAddress,
		address _toTokenAddress,
		uint256 _extAmount
	) public payable returns (uint256) {
		// Before executing the wrapping, determine the amount which needs to be sent to the tokenWrapper
		uint256 wrapAmount = ITokenWrapper(_toTokenAddress).getAmountToWrap(_extAmount);
		// If the address is zero, this is meant to wrap native tokens
		if (_fromTokenAddress == address(0)) {
			require(msg.value == wrapAmount);
			// If the wrapping is native, ensure the amount sent to the tokenWrapper is 0
			ITokenWrapper(_toTokenAddress).wrapForAndSendTo{ value: msg.value }(
				msg.sender,
				_fromTokenAddress,
				0,
				address(this)
			);
		} else {
			// wrap into the token and send directly to this contract
			ITokenWrapper(_toTokenAddress).wrapForAndSendTo{ value: msg.value }(
				msg.sender,
				_fromTokenAddress,
				wrapAmount,
				address(this)
			);
		}
		return wrapAmount;
	}

	/**
		@notice Unwraps into a valid token for the `msg.sender`
		@param _fromTokenAddress The address of the token to unwrap from
		@param _toTokenAddress The address of the token to unwrap into
		@param _recipient The address of the recipient for the unwrapped assets
		@param _minusExtAmount Negative external amount for the transaction
	 */
	function _withdrawAndUnwrap(
		address _fromTokenAddress,
		address _toTokenAddress,
		address _recipient,
		uint256 _minusExtAmount
	) public payable {
		// We first withdraw the assets and send them to `this` contract address.
		// This ensure that when we unwrap the assets, `this` contract has the
		// assets to unwrap into.
		_processWithdraw(_fromTokenAddress, payable(address(this)), _minusExtAmount);

		ITokenWrapper(_fromTokenAddress).unwrapAndSendTo(
			_toTokenAddress,
			_minusExtAmount,
			_recipient
		);
	}

	/**
		@notice Process the withdrawal by sending/minting the wrapped tokens to/for the recipient
		@param _token The token to withdraw
		@param _recipient The recipient of the tokens
		@param _minusExtAmount The amount of tokens to withdraw. Since
		withdrawal ext amount is negative we apply a minus sign once more.
	 */
	function _processWithdraw(
		address _token,
		address _recipient,
		uint256 _minusExtAmount
	) internal virtual {
		uint balance = IERC20(_token).balanceOf(address(this));
		if (balance >= _minusExtAmount) {
			// transfer tokens when balance exists
			IERC20(_token).safeTransfer(_recipient, _minusExtAmount);
		} else {
			// mint tokens when not enough balance exists
			IMintableERC20(_token).mint(_recipient, _minusExtAmount);
		}
	}

	/**
		@notice Process and pay the relayer their fee. Mint the fee if contract has no balance.
		@param _token The token to pay the fee in
		@param _relayer The relayer of the transaction
		@param _fee The fee to pay
	 */
	function _processFee(address _token, address _relayer, uint256 _fee) internal virtual {
		uint balance = IERC20(_token).balanceOf(address(this));
		if (_fee > 0) {
			if (balance >= _fee) {
				// transfer tokens when balance exists
				IERC20(_token).safeTransfer(_relayer, _fee);
			} else {
				IMintableERC20(_token).mint(_relayer, _fee);
			}
		}
	}

	/**
		@notice Process the refund and send it to the recipient. checks if the msg.value is enough to cover the refund
		@param _refund The refund amount in native token
		@param _recipient The recipient of the refund
		@param _relayer The relayer of the transaction
	 */
	function _processRefund(
		uint256 _refund,
		address _recipient,
		address _relayer
	) internal virtual {
		require(msg.value == _refund, "Incorrect refund amount received by the contract");
		(bool success, ) = payable(_recipient).call{ value: _refund }("");
		// if the refund fails, send it back to the relayer
		if (!success) {
			(bool success2, ) = payable(_relayer).call{ value: _refund }("");
			require(success2, "Refund failed");
		}
	}

	/**
        @notice Whether a note is already spent
        @param _nullifierHash The nullifier hash of the deposit note
        @return bool Whether the note is already spent
    */
	function isSpent(uint256 _nullifierHash) public view returns (bool) {
		return nullifierHashes[_nullifierHash];
	}

	/**
        @notice Whether an array of notes is already spent
        @param _nullifierHashes The array of nullifier hashes of the deposit notes
        @return bool[] An array indicated whether each note's nullifier hash is already spent
    */
	function isSpentArray(
		uint256[] calldata _nullifierHashes
	) external view returns (bool[] memory) {
		bool[] memory spent = new bool[](_nullifierHashes.length);
		for (uint256 i = 0; i < _nullifierHashes.length; i++) {
			if (isSpent(_nullifierHashes[i])) {
				spent[i] = true;
			}
		}

		return spent;
	}

	/**
        @notice Set a new handler with a nonce
        @dev Can only be called by the `AnchorHandler` contract
        @param _handler The new handler address
        @param _nonce The nonce for updating the new handler
     */
	function setHandler(
		address _handler,
		uint32 _nonce
	) external override onlyHandler onlyIncrementingByOne(_nonce) {
		require(_handler != address(0), "Handler cannot be 0");
		handler = _handler;
	}
}
