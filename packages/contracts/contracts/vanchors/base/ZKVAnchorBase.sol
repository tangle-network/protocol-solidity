/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

import "./VAnchorBase.sol";
import "../../interfaces/verifiers/ISetVerifier.sol";
import "../../verifiers/TxProofVerifier.sol";

/**
	@title ZK VAnchor Base
	@author Webb Technologies
	@notice The base VAnchor contract for all VAnchors leveraging zero knowledge proofs.
	This contract implements the most basic VAnchor for a single token. All other
	contracts should inherit from this contract and override methods as needed.
 */
abstract contract ZKVAnchorBase is VAnchorBase, TxProofVerifier, ISetVerifier {
	using SafeERC20 for IERC20;

	/**
		@notice The VAnchor constructor
		@param _verifier The address of SNARK verifier for this contract
		@param _levels The height/# of levels of underlying Merkle Tree
		@param _handler The address of AnchorHandler for this contract
		@param _maxEdges The maximum number of edges in the LinkableAnchor + Verifier supports.
		@notice The `_maxEdges` is zero-knowledge circuit dependent, meaning the
		`_verifier` ONLY supports a certain maximum # of edges. Therefore we need to
		limit the size of the LinkableAnchor with this parameter.
	*/
	constructor(
		IAnchorVerifier _verifier,
		uint32 _levels,
		address _handler,
		uint8 _maxEdges
	) VAnchorBase(_levels, _handler, _maxEdges) TxProofVerifier(_verifier) {}

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
			require(
				uint256(_externalData.extAmount) <= maximumDepositAmount,
				"amount is larger than maximumDepositAmount"
			);
			if (_externalData.token == _wrappedToken) {
				IERC20(_wrappedToken).safeTransferFrom(
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
			require(
				uint256(-_externalData.extAmount) >= minimalWithdrawalAmount,
				"amount is less than minimalWithdrawalAmount"
			);
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
			if (_externalData.refund > 0) {
				_processRefund(
					_externalData.refund,
					_externalData.recipient,
					_externalData.relayer
				);
			}
		}

		if (_externalData.fee > 0) {
			_processFee(_wrappedToken, _externalData.relayer, _externalData.fee);
		}

		_executeInsertions(_publicInputs, _encryptions);
	}

	/**
		@notice Inserts the output commitments into the underlying merkle system
		@param _publicInputs The public inputs for the proof
		@param _encryptions The encryptions of the output commitments
	 */
	function _executeInsertions(
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) internal virtual;

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
		bytes32 extDataHash = _genExtDataHash(_auxPublicInputs, _externalData, _encryptions);

		for (uint256 i = 0; i < _publicInputs.inputNullifiers.length; i++) {
			require(!isSpent(_publicInputs.inputNullifiers[i]), "Input is already spent");
		}
		require(
			uint256(_publicInputs.extDataHash) == uint256(extDataHash) % FIELD_SIZE,
			"Incorrect external data hash"
		);
		require(
			_publicInputs.publicAmount ==
				calculatePublicAmount(_externalData.extAmount, _externalData.fee),
			"Invalid public amount"
		);
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
		@param _encryptions The encrypted outputs
	 */
	function _executeVerification(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) internal virtual;

	function _genExtDataHash(
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		Encryptions memory _encryptions
	) public virtual returns (bytes32);

	/**
		@notice Set a new verifier with a nonce
		@dev Can only be called by the `AnchorHandler` contract
		@param _verifier The new verifier address
		@param _nonce The nonce for updating the new verifier
	 */
	function setVerifier(
		address _verifier,
		uint32 _nonce
	) external override onlyHandler onlyIncrementingByOne(_nonce) {
		require(_verifier != address(0), "Handler cannot be 0");
		verifier = IAnchorVerifier(_verifier);
	}
}
