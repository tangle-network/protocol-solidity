/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../interfaces/ITokenWrapper.sol";
import "../interfaces/IMintableERC20.sol";
import "./VAnchorBase.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
	@title Variable Anchor contract
	@author Webb Technologies
	@notice The Variable Anchor is a variable-denominated shielded pool system
	derived from Tornado Nova (tornado-pool). This system extends the shielded
	pool system into a bridged system and allows for join/split transactions.

	The system is built on top the VAnchorBase/AnchorBase/LinkableTree system which allows
	it to be linked to other VAnchor contracts through a simple graph-like
	interface where anchors maintain edges of their neighboring anchors.

	The system requires users to create and deposit UTXOs for the supported ERC20
	asset into the smart contract and insert a commitment into the underlying
	merkle tree of the form: commitment = Poseidon(chainID, amount, pubKey, blinding).
	The hash input is the UTXO data. All deposits/withdrawals are unified under
	a common `transact` function which requires a zkSNARK proof that the UTXO commitments
	are well-formed (i.e. that the deposit amount matches the sum of new UTXOs' amounts).
	
	Information regarding the commitments:
	- Poseidon is a zkSNARK friendly hash function
	- destinationChainID is the chainId of the destination chain, where the withdrawal
	  is intended to be made
	- Details of the UTXO and hashes are below

	UTXO = { destinationChainID, amount, pubkey, blinding }
	commitment = Poseidon(destinationChainID, amount, pubKey, blinding)
	nullifier = Poseidon(commitment, merklePath, sign(privKey, commitment, merklePath))

	Commitments adhering to different hash functions and formats will invalidate
	any attempt at withdrawal.
	
	Using the preimage / UTXO of the commitment, users can generate a zkSNARK proof that
	the UTXO is located in one-of-many VAnchor merkle trees and that the commitment's
	destination chain id matches the underlying chain id of the VAnchor where the
	transaction is taking place. The chain id opcode is leveraged to prevent any
	tampering of this data.
 */
contract VAnchor is VAnchorBase {
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
		@param _maxEdges The maximum number of edges in the LinkableTree + Verifier supports.
		@notice The `_maxEdges` is zero-knowledge circuit dependent, meaning the
		`_verifier` ONLY supports a certain maximum # of edges. Therefore we need to
		limit the size of the LinkableTree with this parameter.
	*/
	constructor(
		IAnchorVerifier _verifier,
		uint32 _levels,
		IPoseidonT3 _hasher,
		address _handler,
		address _token,
		uint8 _maxEdges
	) VAnchorBase (
		_verifier,
		_levels,
		_hasher,
		_handler,
		_maxEdges
	) {token = _token;}

	/**
		@notice Wraps a token for the `msg.sender` using the underlying FixedDepositAnchor's TokenWrapper contract
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
	// TODO: Rename to _executeWrapping
	function wrapAndDeposit(
		address _tokenAddress,
		uint256 _extAmount
	) payable public {
		// wrap into the token and send directly to this contract
		if (_tokenAddress == address(0)) {
				require(msg.value == _extAmount);
				ITokenWrapper(token).wrapForAndSendTo{value: msg.value}(
						msg.sender,
						_tokenAddress,
						0,
						address(this)
				);
		}
		else {
				ITokenWrapper(token).wrapForAndSendTo(
						msg.sender,
						_tokenAddress,
						_extAmount,
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
	// TODO: Rename _executeUnwrapping
	function withdrawAndUnwrap(
		address _tokenAddress,
		address _recipient,
		uint256 _minusExtAmount
	) public payable nonReentrant {
		// We first withdraw the assets and send them to `this` contract address.
		// This ensure that when we unwrap the assets, `this` contract has the
		// assets to unwrap into.
		_processWithdraw(payable(address(this)), _minusExtAmount);

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
	) public {
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
	) public {
		register(_account);
		transactWrap(_proofArgs, _extData, _tokenAddress);
	}

	/**
		@notice Executes a deposit/withdrawal or combination join/split transaction
		@param _args The zkSNARK proof parameters
		@param _extData The external data for the transaction
	 */
	function transact(VAnchorEncodeInputs.Proof memory _args, ExtData memory _extData) public nonReentrant {
		_executeValidationAndVerification(_args, _extData);

		if (_extData.extAmount > 0) {
			IMintableERC20(token).transferFrom(msg.sender, address(this), uint256(_extData.extAmount));
			require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
		}

		if (_extData.extAmount < 0) {
			require(_extData.recipient != address(0), "Can't withdraw to zero address");
			require(uint256(-_extData.extAmount) >= minimalWithdrawalAmount, "amount is less than minimalWithdrawalAmount"); // prevents ddos attack to Bridge
			_processWithdraw(_extData.recipient, uint256(-_extData.extAmount));
		}
		if (_extData.fee > 0) {
			_processFee(_extData.relayer, _extData.fee);
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
	) public payable {
		_executeValidationAndVerification(_args, _extData);

		// Check if extAmount > 0, call wrapAndDeposit
		if (_extData.extAmount > 0) {
			//wrapAndDeposit
			require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
			wrapAndDeposit(_tokenAddress, uint256(_extData.extAmount));
		} 
		// Otherwise, check if extAmount < 0, call withdrawAndUnwrap
		if (_extData.extAmount < 0) {
			require(_extData.recipient != address(0), "Can't withdraw to zero address");
			require(uint256(-_extData.extAmount) >= minimalWithdrawalAmount, "amount is less than minimalWithdrawalAmount"); 
			withdrawAndUnwrap(_tokenAddress, _extData.recipient, uint256(-_extData.extAmount));
		}

		if (_extData.fee > 0) {
			_processFee(_extData.relayer, _extData.fee);
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
	function _executeVerification(VAnchorEncodeInputs.Proof memory _args) view internal {
		if (_args.inputNullifiers.length == 2) {
			(bytes memory encodedInput, bytes32[] memory roots) = VAnchorEncodeInputs._encodeInputs2(_args, maxEdges);
			require(isValidRoots(roots), "Invalid roots");
			require(verify2(_args.proof, encodedInput), "Invalid transaction proof");
		} else if (_args.inputNullifiers.length == 16) {
			(bytes memory encodedInput, bytes32[] memory roots) = VAnchorEncodeInputs._encodeInputs16(_args, maxEdges);
			require(isValidRoots(roots), "Invalid roots");
			require(verify16(_args.proof, encodedInput), "Invalid transaction proof");
		} else {
			revert("unsupported input count");
		}
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
		@param _recipient The recipient of the tokens
		@param _minusExtAmount The amount of tokens to withdraw. Since
		withdrawal ext amount is negative we apply a minus sign once more.
	 */
	function _processWithdraw(
		address _recipient,
		uint256 _minusExtAmount
	) internal override {
		uint balance = IERC20(token).balanceOf(address(this));
		if (balance >= _minusExtAmount) {
			// transfer tokens when balance exists
			IERC20(token).safeTransfer(_recipient, _minusExtAmount);
		} else {
			// mint tokens when not enough balance exists
			IMintableERC20(token).mint(_recipient, _minusExtAmount);
		}
	}

	/**
		@notice Process and pay the relayer their fee. Mint the fee if contract has no balance.
		@param _relayer The relayer of the transaction
		@param _fee The fee to pay
	 */
	function _processFee(
		address _relayer,
		uint256 _fee
	) internal override {
		uint balance = IERC20(token).balanceOf(address(this));
		if (_fee > 0) {
			if (balance >= _fee) {
				// transfer tokens when balance exists
				IERC20(token).safeTransfer(_relayer, _fee);
			}
			else {
				IMintableERC20(token).mint(_relayer, _fee);
			}
		}
	}
}
