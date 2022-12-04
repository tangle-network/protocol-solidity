/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./VAnchorBase.sol";
import "../interfaces/tokens/ITokenWrapper.sol";
import "../interfaces/tokens/IMintableERC20.sol";
import "../interfaces/verifiers/ISetVerifier.sol";
import "../libs/VAnchorEncodeInputs.sol";
import "../verifiers/TxProofVerifier.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";

/**
	@title ZK VAnchor Base
	@author Webb Technologies
	@notice The base VAnchor contract for all VAnchors leveraging zero knowledge proofs.
    This contract implements the most basic VAnchor for a single token. All other
    contracts should inherit from this contract and override methods as needed.
 */
abstract contract ZKVAnchorBase is VAnchorBase, TxProofVerifier, ISetVerifier {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;

	/**
		@notice The VAnchor constructor
		@param _verifier The address of SNARK verifier for this contract
		@param _levels The height/# of levels of underlying Merkle Tree
		@param _hasher The address of hash contract
		@param _handler The address of AnchorHandler for this contract
		@param _maxEdges The maximum number of edges in the LinkableAnchor + Verifier supports.
		@notice The `_maxEdges` is zero-knowledge circuit dependent, meaning the
		`_verifier` ONLY supports a certain maximum # of edges. Therefore we need to
		limit the size of the LinkableAnchor with this parameter.
	*/
	constructor(
		IAnchorVerifier _verifier,
		uint32 _levels,
		IHasher _hasher,
		address _handler,
		uint8 _maxEdges
	)
		VAnchorBase (_levels, _hasher, _handler, _maxEdges)
		TxProofVerifier(_verifier)
	{}

	/**
		@notice Registers and transacts in a single flow
		@param _proof The zkSNARK proof
		@param _externalData The serialized external data
		@param _auxPublicInputs The extension public inputs for the zkSNARK proof
		@param _publicInputs The public inputs for the zkSNARK proof
		@param _encryptions The encrypted outputs
	 */
	function registerAndTransact(
		Account memory _account,
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) public payable virtual {
		register(_account);
		transact(_proof, _auxPublicInputs, _externalData, _publicInputs, _encryptions);
	}

	/**
		@notice Transacts in a single flow
		@param _proof The zkSNARK proof
		@param _externalData The serialized external data
		@param _auxPublicInputs The extension public inputs for the zkSNARK proof
		@param _publicInputs The public inputs for the zkSNARK proof
		@param _encryptions The encrypted outputs
	 */
	function transact(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) public payable virtual;

	/**
		@notice Executes a deposit/withdrawal or combination join/split transaction
        including possible wrapping or unwrapping if a valid token is provided.
		@param _wrappedToken The wrapped token address (only tokens living on the bridge)
		@param _proof The zkSNARK proof
		@param _externalData The serialized external data
		@param _auxPublicInputs The extension public inputs for the zkSNARK proof
		@param _publicInputs The public inputs for the zkSNARK proof
		@param _encryptions The encrypted outputs
	 */
	function _transact(
		address _wrappedToken,
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) internal virtual {
		_executeValidationAndVerification(
			_proof,
			_auxPublicInputs,
			_externalData,
			_publicInputs,
			_encryptions
		);

		// Check if extAmount > 0, call wrapAndDeposit
        if (_externalData.extAmount > 0) {
			require(uint256(_externalData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
			if (_externalData.token == _wrappedToken) {
				IMintableERC20(_wrappedToken).transferFrom(
					msg.sender,
					address(this),
					uint256(_externalData.extAmount)
				);
			} else {
				_executeWrapping(
					_externalData.token,
					_wrappedToken,
					uint256(_externalData.extAmount)
				);
			}
		}

		if (_externalData.extAmount < 0) {
			require(_externalData.recipient != address(0), "Can't withdraw to zero address");
			// Prevents ddos attack to Bridge
			require(uint256(-_externalData.extAmount) >= minimalWithdrawalAmount, "amount is less than minimalWithdrawalAmount"); 
			if (_externalData.token == _wrappedToken) {
				_processWithdraw(
					_wrappedToken,
					_externalData.recipient,
					uint256(-_externalData.extAmount)
				);
			} else {
				_withdrawAndUnwrap(
					_wrappedToken,
					_externalData.token,
					_externalData.recipient,
					uint256(-_externalData.extAmount)
				);
			}
		}

		if (_externalData.fee > 0) {
			_processFee(_wrappedToken, _externalData.relayer, _externalData.fee);
		}

		_executeInsertions(_publicInputs, _encryptions);
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
	) payable public returns (uint256) {
		// Before executing the wrapping, determine the amount which needs to be sent to the tokenWrapper
		uint256 wrapAmount = ITokenWrapper(_toTokenAddress).getAmountToWrap(_extAmount);

		// If the address is zero, this is meant to wrap native tokens
		if (_fromTokenAddress == address(0)) {
			require(msg.value == wrapAmount);
			// If the wrapping is native, ensure the amount sent to the tokenWrapper is 0
			ITokenWrapper(_toTokenAddress).wrapForAndSendTo{value: msg.value}(
					msg.sender,
					_fromTokenAddress,
					0,
					address(this)
			);
		} else {
			// wrap into the token and send directly to this contract
			ITokenWrapper(_toTokenAddress).wrapForAndSendTo{value: msg.value}(
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
	) public payable nonReentrant {
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
		@notice Checks whether the transaction is valid
		1. Checks that the nullifiers are not spent
		2. Checks that the public amount is valid (doesn't exceed the MAX_FEE or MAX_EXT_AMOUNT and doesn't overflow)
		3. Checks that the zkSNARK proof verifies
		@param _proof The zkSNARK proof
		@param _externalData The serialized external data
		@param _auxPublicInputs The extension public inputs for the zkSNARK proof
		@param _publicInputs The public inputs for the zkSNARK proof
		@param _encryptions The encrypted outputs
	 */
	function _executeValidationAndVerification(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) internal virtual {
		bytes32 extDataHash = _genExtDataHash(
			_auxPublicInputs,
			_externalData,
			_encryptions
		);

		for (uint256 i = 0; i < _publicInputs.inputNullifiers.length; i++) {
			require(!isSpent(_publicInputs.inputNullifiers[i]), "Input is already spent");
		}
		require(uint256(_publicInputs.extDataHash) == uint256(extDataHash) % FIELD_SIZE, "Incorrect external data hash");
		require(_publicInputs.publicAmount == calculatePublicAmount(_externalData.extAmount, _externalData.fee), "Invalid public amount");
		_executeVerification(_proof, _auxPublicInputs, _publicInputs, _encryptions);

		for (uint256 i = 0; i < _publicInputs.inputNullifiers.length; i++) {
			// sets the nullifier for the input UTXO to spent
			nullifierHashes[_publicInputs.inputNullifiers[i]] = true;
		}
	}

	/**
		@notice Verifies the zero-knowledge proof and validity of roots/public inputs.
		@param _proof The zkSNARK proof
		@param _auxPublicInputs The extension public inputs for the zkSNARK proof
		@param _publicInputs The public inputs for the zkSNARK proof
	 */
	function _executeVerification(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		PublicInputs memory _publicInputs,
		Encryptions memory
	) internal virtual;

	/**
		@notice Inserts the output commitments into the underlying merkle tree
		@param _publicInputs The public inputs for the proof
	 */
	function _executeInsertions(
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) internal {
		insertTwo(_publicInputs.outputCommitments[0], _publicInputs.outputCommitments[1]);
		emit NewCommitment(_publicInputs.outputCommitments[0], nextIndex - 2, _encryptions.encryptedOutput1);
		emit NewCommitment(_publicInputs.outputCommitments[1], nextIndex - 1, _encryptions.encryptedOutput2);
		for (uint256 i = 0; i < _publicInputs.inputNullifiers.length; i++) {
			emit NewNullifier(_publicInputs.inputNullifiers[i]);
		}
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
	) internal override {
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
	function _processFee(
		address _token,
		address _relayer,
		uint256 _fee
	) internal override {
		uint balance = IERC20(_token).balanceOf(address(this));
		if (_fee > 0) {
			if (balance >= _fee) {
				// transfer tokens when balance exists
				IERC20(_token).safeTransfer(_relayer, _fee);
			}
			else {
				IMintableERC20(_token).mint(_relayer, _fee);
			}
		}
	}

	function _genExtDataHash(
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		Encryptions memory _encryptions
	) internal virtual returns (bytes32);

	/**
		@notice Set a new verifier with a nonce
		@dev Can only be called by the `AnchorHandler` contract
		@param _verifier The new verifier address
		@param _nonce The nonce for updating the new verifier
	 */
	function setVerifier(
		address _verifier,
		uint32 _nonce
	) override onlyHandler onlyIncrementingByOne(_nonce) external {
		require(_verifier != address(0), "Handler cannot be 0");
		verifier = IAnchorVerifier(_verifier);
	}
}
