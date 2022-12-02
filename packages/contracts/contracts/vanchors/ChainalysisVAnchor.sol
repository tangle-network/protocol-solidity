/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./VAnchorBase.sol";
import "../structs/SingleAssetExtData.sol";
import "../interfaces/tokens/ITokenWrapper.sol";
import "../interfaces/tokens/IMintableERC20.sol";
import "../interfaces/verifiers/ISetVerifier.sol";
import "../utils/SanctionFilter.sol";
import "../libs/VAnchorEncodeInputs.sol";
import "../verifiers/TxProofVerifier.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
	@title Chainalysis Variable Anchor contract
	@author Webb Technologies
	@notice The main addition here is a filter for sanctioned addresses on transactions.
 */
contract ChainalysisVAnchor is VAnchorBase, TxProofVerifier, SanctionFilter, ISetVerifier {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;
	address public immutable token;

	/**
		@notice The VAnchor constructor
		@param _verifier The address of SNARK verifier for this contract
		@param _levels The height/# of levels of underlying Merkle Tree
		@param _hasher The address of hash contract
		@param _handler The address of AnchorHandler for this contract
		@param _token The address of the token that is used to pay the deposit
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
		address _token,
		uint8 _maxEdges
	)
		VAnchorBase (_levels, _hasher, _handler, _maxEdges)
		TxProofVerifier(_verifier)
	{
		token = _token;
	}

	/**
		@notice Wraps a token for the `msg.sender` using the underlying TokenWrapper contract
		@param _tokenAddress The address of the token to wrap
		@param _amount The amount of tokens to wrap
	 */
	function wrapToken(address _tokenAddress, uint256 _amount) public {
		ITokenWrapper(token).wrapFor(msg.sender, _tokenAddress, _amount);
	}

	/**
		@notice Unwraps the TokenWrapper token for the `msg.sender` into one of its wrappable tokens.
		@param _tokenAddress The address of the token to unwrap into
		@param _amount The amount of tokens to unwrap
	 */
	function unwrapIntoToken(address _tokenAddress, uint256 _amount) public {
		ITokenWrapper(token).unwrapFor(msg.sender, _tokenAddress, _amount);
	}

	/**
		@notice Wrap the native token for the `msg.sender` into the TokenWrapper token
		@notice The amount is taken from `msg.value`
	 */
	function wrapNative() payable public {
		ITokenWrapper(token).wrapFor{value: msg.value}(msg.sender, address(0), 0);
	}

	/**
		@notice Unwrap the TokenWrapper token for the `msg.sender` into the native token
		@param _amount The amount of tokens to unwrap
	 */
	function unwrapIntoNative(address _tokenAddress, uint256 _amount) public {
		ITokenWrapper(token).unwrapFor(msg.sender, _tokenAddress, _amount);
	}
	
	/**
		@notice Wraps a token for the `msg.sender`
		@param _tokenAddress The address of the token to wrap
		@param _extAmount The external amount for the transaction
	 */
	function _executeWrapping(
		address _tokenAddress,
		uint256 _extAmount
	) payable public isNotSanctioned(msg.sender) {
		// Before executing the wrapping, determine the amount which needs to be sent to the tokenWrapper
		uint256 wrapAmount = ITokenWrapper(token).getAmountToWrap(_extAmount);

		// If the address is zero, this is meant to wrap native tokens
		if (_tokenAddress == address(0)) {
			require(msg.value == wrapAmount);
			// If the wrapping is native, ensure the amount sent to the tokenWrapper is 0
			ITokenWrapper(token).wrapForAndSendTo{value: msg.value}(
					msg.sender,
					_tokenAddress,
					0,
					address(this)
			);
		} else {
			// wrap into the token and send directly to this contract
			ITokenWrapper(token).wrapForAndSendTo{value: msg.value}(
					msg.sender,
					_tokenAddress,
					wrapAmount,
					address(this)
			);
		}
	}

	/**
		@notice Unwraps into a valid token for the `msg.sender`
		@param _tokenAddress The token to unwrap into
		@param _recipient The address of the recipient for the unwrapped assets
		@param _minusExtAmount Negative external amount for the transaction
	 */
	function withdrawAndUnwrap(
		address _tokenAddress,
		address _recipient,
		uint256 _minusExtAmount
	) public payable nonReentrant isNotSanctioned(msg.sender) isNotSanctioned(_recipient) {
		// We first withdraw the assets and send them to `this` contract address.
		// This ensure that when we unwrap the assets, `this` contract has the
		// assets to unwrap into.
		_processWithdraw(token, payable(address(this)), _minusExtAmount);

		ITokenWrapper(token).unwrapAndSendTo(
			_tokenAddress,
			_minusExtAmount,
			_recipient
		);
	}

	/**
		@notice Registers and transacts in a single flow
		@param _account The account to register
		@param _proofArgs The zkSNARK proof parameters
		@param _extData The external data for the transaction
	 */
	function registerAndTransact(
		Account memory _account,
		VAnchorEncodeInputs.Proof memory _proofArgs,
		ExtData memory _extData
	) public isNotSanctioned(msg.sender) isNotSanctioned(_extData.recipient) {
		register(_account);
		transact(_proofArgs, _extData);
	}

	/**
		@notice Registers and transacts and wraps in a single flow
		@param _account The account to register
		@param _proofArgs The zkSNARK proof parameters
		@param _extData The external data for the transaction
		@param _tokenAddress The token to wrap from
	 */
	function registerAndTransactWrap(
		Account memory _account,
		VAnchorEncodeInputs.Proof memory _proofArgs,
		ExtData memory _extData,
		address _tokenAddress
	) public isNotSanctioned(msg.sender) isNotSanctioned(_extData.recipient) {
		register(_account);
		transactWrap(_proofArgs, _extData, _tokenAddress);
	}

	/**
		@notice Executes a deposit/withdrawal or combination join/split transaction
		@param _args The zkSNARK proof parameters
		@param _extData The external data for the transaction
	 */
	function transact(
		VAnchorEncodeInputs.Proof memory _args,
		ExtData memory _extData
	) public nonReentrant isNotSanctioned(msg.sender) isNotSanctioned(_extData.recipient) {
		_executeValidationAndVerification(_args, _extData);

		if (_extData.extAmount > 0) {
			require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
			IMintableERC20(token).transferFrom(msg.sender, address(this), uint256(_extData.extAmount));
		}

		if (_extData.extAmount < 0) {
			require(_extData.recipient != address(0), "Can't withdraw to zero address");
			require(uint256(-_extData.extAmount) >= minimalWithdrawalAmount, "amount is less than minimalWithdrawalAmount"); // prevents ddos attack to Bridge
			_processWithdraw(token, _extData.recipient, uint256(-_extData.extAmount));
		}
		if (_extData.fee > 0) {
			_processFee(token, _extData.relayer, _extData.fee);
		}

		_executeInsertions(_args, _extData);
	}

	/**
		@notice Executes a deposit/withdrawal or combination join/split transaction including wrapping or unwrapping
		@param _args The zkSNARK proof parameters
		@param _extData The external data for the transaction
		@param _tokenAddress The token to wrap from or unwrap into depending on the positivity of `_extData.extAmount`
	 */
	function transactWrap(
		VAnchorEncodeInputs.Proof memory _args,
		ExtData memory _extData,
		address _tokenAddress
	) public payable isNotSanctioned(msg.sender) isNotSanctioned(_extData.recipient) {
		_executeValidationAndVerification(_args, _extData);

		// Check if extAmount > 0, call wrapAndDeposit
		if (_extData.extAmount > 0) {
			//wrapAndDeposit
			require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
			_executeWrapping(_tokenAddress, uint256(_extData.extAmount));
		} else if (_extData.extAmount < 0) {
			// Otherwise, check if extAmount < 0, call withdrawAndUnwrap
			require(_extData.recipient != address(0), "Can't withdraw to zero address");
			require(uint256(-_extData.extAmount) >= minimalWithdrawalAmount, "amount is less than minimalWithdrawalAmount"); 
			withdrawAndUnwrap(_tokenAddress, _extData.recipient, uint256(-_extData.extAmount));
		}

		if (_extData.fee > 0) {
			_processFee(token, _extData.relayer, _extData.fee);
		}

		_executeInsertions(_args, _extData);
	}

	/**
		@notice Checks whether the transaction is valid
		1. Checks that the nullifiers are not spent
		2. Checks that the public amount is valid (doesn't exceed the MAX_FEE or MAX_EXT_AMOUNT and doesn't overflow)
		3. Checks that the zkSNARK proof verifies
		@param _args The zkSNARK proof parameters
		@param _extData The external data for the transaction
	 */
	function _executeValidationAndVerification(VAnchorEncodeInputs.Proof memory _args, ExtData memory _extData) internal {
		for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
			require(!isSpent(_args.inputNullifiers[i]), "Input is already spent");
		}
		require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE, "Incorrect external data hash");
		require(_args.publicAmount == calculatePublicAmount(_extData.extAmount, _extData.fee), "Invalid public amount");
		_executeVerification(_args);

		for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
			// sets the nullifier for the input UTXO to spent
			nullifierHashes[_args.inputNullifiers[i]] = true;
		}
	}

	/**
		@notice Checks whether the zkSNARK proof is valid
		@param _args The zkSNARK proof parameters
	 */
	function _executeVerification(VAnchorEncodeInputs.Proof memory _args) internal view {
		require(_args.inputNullifiers.length == 2 || _args.inputNullifiers.length == 16, "Invalid number of inputs");
		bool smallInputs = _args.inputNullifiers.length == 2;
		(bytes memory encodedInput, bytes32[] memory roots) = smallInputs
			? VAnchorEncodeInputs._encodeInputs2(_args, maxEdges)
			: VAnchorEncodeInputs._encodeInputs16(_args, maxEdges);


		require(isValidRoots(roots), "Invalid vanchor roots");
		require(verify(_args.proof, encodedInput, smallInputs, maxEdges), "Invalid transaction proof");
	}

	/**
		@notice Inserts the output commitments into the underlying merkle tree
		@param _args The zkSNARK proof parameters
		@param _extData The external data for the transaction
	 */
	function _executeInsertions(VAnchorEncodeInputs.Proof memory _args, ExtData memory _extData) internal {
		insertTwo(_args.outputCommitments[0], _args.outputCommitments[1]);
		emit NewCommitment(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1);
		emit NewCommitment(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2);
		for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
			emit NewNullifier(_args.inputNullifiers[i]);
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
