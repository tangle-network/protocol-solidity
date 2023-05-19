/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "./ZKVAnchorBase.sol";
import "../../structs/SingleAssetExtData.sol";
import "../../libs/VAnchorEncodeInputs.sol";

/**
	@title Variable Anchor contract
	@author Webb Technologies
	@notice The Variable Anchor is a variable-denominated shielded pool system
	derived from Tornado Nova (tornado-pool). This system extends the shielded
	pool system into a bridged system and allows for join/split transactions.

	The system is built on top the VAnchorBase/AnchorBase/LinkableAnchor system which allows
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
abstract contract VAnchor is ZKVAnchorBase {
	address public immutable token;

	constructor(
		IAnchorVerifier _verifier,
		uint32 _levels,
		address _handler,
		address _token,
		uint8 _maxEdges
	) ZKVAnchorBase(_verifier, _levels, _handler, _maxEdges) {
		token = _token;
	}

	/// @inheritdoc ZKVAnchorBase
	function transact(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) public payable virtual override {
		_transact(token, _proof, _auxPublicInputs, _externalData, _publicInputs, _encryptions);
	}

	/// @inheritdoc ZKVAnchorBase
	function _executeVerification(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		PublicInputs memory _publicInputs,
		Encryptions memory
	) internal virtual override {
		require(
			_publicInputs.inputNullifiers.length == 2 || _publicInputs.inputNullifiers.length == 16,
			"Invalid number of inputs"
		);
		bool smallInputs = _publicInputs.inputNullifiers.length == 2;
		(bytes memory encodedInput, uint256[] memory roots) = smallInputs
			? VAnchorEncodeInputs._encodeInputs2(_publicInputs, _auxPublicInputs, maxEdges)
			: VAnchorEncodeInputs._encodeInputs16(_publicInputs, _auxPublicInputs, maxEdges);

		require(isValidRoots(roots), "Invalid vanchor roots");
		require(verify(_proof, encodedInput, smallInputs, maxEdges), "Invalid transaction proof");
	}

	/// @inheritdoc ZKVAnchorBase
	function _genExtDataHash(
		bytes memory,
		CommonExtData memory _externalData,
		Encryptions memory _encryptions
	) public virtual override returns (bytes32) {
		return
			keccak256(
				abi.encode(
					ExtData(
						_externalData.recipient,
						_externalData.extAmount,
						_externalData.relayer,
						_externalData.fee,
						_externalData.refund,
						_externalData.token,
						_encryptions.encryptedOutput1,
						_encryptions.encryptedOutput2
					)
				)
			);
	}
}
