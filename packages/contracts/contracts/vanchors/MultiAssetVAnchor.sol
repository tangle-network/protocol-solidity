/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../vanchors/ZKVAnchorBase.sol";
import "../structs/MultiAssetExtData.sol";
import "../libs/MASPVAnchorEncodeInputs.sol";
import "../interfaces/tokens/IRegistry.sol";

/**
	@title Multi Asset Variable Anchor contract
	@author Webb Technologies
	@notice The Multi Asset Variable Anchor is a variable-denominated shielded pool system
	derived from Tornado Nova (tornado-pool) that supports multiple assets in a single pool.
	This system extends the shielded pool system into a bridged system and allows for
	join/split transactions of different assets at 2 same time.

	The system is built on top the MultiAssetVAnchorBase/AnchorBase/LinkableAnchor system
	which allows it to be linked to other VAnchor contracts through a simple graph-like
	interface where anchors maintain edges of their neighboring anchors.

	The system requires users to create UTXOs for any supported ERC20 asset into the smart
	contract and insert a commitment into the underlying merkle tree of the form:
	```
	commitment = Poseidon(assetId, amount, Poseidon(destinationChainID, pubKey, blinding)).
	```
	The hash input is the UTXO data. All deposits/withdrawals are unified under
	a common `transact` function which requires a zkSNARK proof that the UTXO commitments
	are well-formed (i.e. that the deposit amount matches the sum of new UTXOs' amounts).
	
	Information regarding the commitments:
	- Poseidon is a zkSNARK friendly hash function
	- destinationChainID is the chainId of the destination chain, where the withdrawal
	  is intended to be made
	- Details of the UTXO and hashes are below

	UTXO = { assetId, amount, Poseidon(destinationChainID, pubKey, blinding) }
	commitment = Poseidon(assetId, amount, Poseidon(destinationChainID, pubKey, blinding))
	nullifier = Poseidon(commitment, merklePath, sign(privKey, commitment, merklePath))

	Commitments adhering to different hash functions and formats will invalidate
	any attempt at withdrawal.
	
	Using the preimage / UTXO of the commitment, users can generate a zkSNARK proof that
	the UTXO is located in one-of-many VAnchor merkle trees and that the commitment's
	destination chain id matches the underlying chain id of the VAnchor where the
	transaction is taking place. The chain id opcode is leveraged to prevent any
	tampering of this data.

	Part of the benefit of a MASP is the ability to handle multiple assets in a single pool.
	To support this, the system uses a `assetId` field in the UTXO to identify the asset.
	One thing to remember is that all assets in the pool must be wrapped ERC20 tokens specific
	to the pool. We refer to this tokens as the bridge ERC20 tokens. Part of the challenge of building
	the MASP then is dealing with the mapping between bridge ERC20s and their asset IDs.

	IMPORTANT: A bridge ERC20 token MUST have the same assetID across chain.
 */
contract MultiAssetVAnchor is ZKVAnchorBase {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;

	address public registry;

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
		IRegistry _registry,
		IAnchorVerifier _verifier,
		uint32 _levels,
		IHasher _hasher,
		address _handler,
		uint8 _maxEdges
	)
		ZKVAnchorBase(_verifier, _levels, _hasher, _handler, _maxEdges)
	{
		registry = address(_registry);
	}

	/**
		@notice Wraps and deposits in a single flow without a proof. Leads to a single non-zero UTXO.
		@param _fromTokenAddress The address of the token to wrap from
		@param _toTokenAddress The address of the token to wrap into
		@param _amount The amount of tokens to wrap
		@param partialCommitment The partial commitment of the UTXO
		@param encryptedCommitment The encrypted commitment of the partial UTXO
	 */
	function wrapAndDepositERC20(
		address _fromTokenAddress,
		address _toTokenAddress,
		uint256 _amount,
		bytes32 partialCommitment,
		bytes memory encryptedCommitment
	) public payable {
		// Execute the wrapping
		uint256 wrapAmount = _executeWrapping(
			_fromTokenAddress,
			_toTokenAddress,
			_amount
		);
		// Create the record commitment
		uint256 assetID = IRegistry(registry).getAssetId(_toTokenAddress);
		bytes32 commitment = bytes32(IHasher(hasher).hash3([
			assetID,
			wrapAmount,
			uint256(partialCommitment)
		]));
		insertTwo(commitment, bytes32(0x0));
		emit NewCommitment(commitment, nextIndex - 2, encryptedCommitment);
	}

	/// @inheritdoc ZKVAnchorBase
	function transact(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) override public payable virtual {
		AuxPublicInputs memory aux = abi.decode(_auxPublicInputs, (AuxPublicInputs));
		address wrappedToken = IRegistry(registry).getAssetAddress(aux.assetID);
		_transact(
			wrappedToken,
			_proof,
			_auxPublicInputs,
			_externalData,
			_publicInputs,
			_encryptions
		);
	}

	/**
		@notice Verifies the zero-knowledge proof and validity of roots/public inputs.
		@param _proof The zkSNARK proof
		@param _auxPublicInputs The extension public inputs for the zkSNARK proof
		@param _publicInputs The public inputs for the zkSNARK proof
		@param _encryptions The encrypted outputs to verify using verifiable viewing keys
	 */
	function _executeVerification(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) override internal virtual {
		require(_publicInputs.inputNullifiers.length == 2 || _publicInputs.inputNullifiers.length == 16, "Invalid number of inputs");
		bool smallInputs = _publicInputs.inputNullifiers.length == 2;
		(bytes memory encodedInput, bytes32[] memory roots) = smallInputs
			? MASPVAnchorEncodeInputs._encodeInputs2(_publicInputs, _auxPublicInputs, maxEdges)
			: MASPVAnchorEncodeInputs._encodeInputs16(_publicInputs, _auxPublicInputs, maxEdges);


		require(isValidRoots(roots), "Invalid vanchor roots");
		require(verify(_proof, encodedInput, smallInputs, maxEdges), "Invalid transaction proof");
	}

	/// @inheritdoc ZKVAnchorBase
	function _genExtDataHash(
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		Encryptions memory _encryptions
	) override internal virtual returns (bytes32) {
		AuxPublicInputs memory aux = abi.decode(_auxPublicInputs, (AuxPublicInputs));
		return keccak256(abi.encode(
			ExtData(
				aux.assetID,
				_externalData.recipient,
				_externalData.extAmount,
				_externalData.relayer,
				_externalData.fee,
				_externalData.refund,
				_externalData.token,
				_encryptions.encryptedOutput1,
				_encryptions.encryptedOutput2
			)
		));
	}
}
