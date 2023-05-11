/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "@webb-tools/protocol-solidity/vanchors/instances/VAnchorTree.sol";
import "./IdentityVAnchorEncodeInputs.sol";
import "./ISemaphoreGroups.sol";

/**
	@title Identity VAnchor contract
	@author Webb Technologies

	@notice The Identity Variable Anchor is a variable-denominated shielded pool system
	derived from Tornado Nova (tornado-pool) with identity constrains on top. This system
	extends the shielded pool system into a bridged system and allows for join/split transactions.
	The identity extensions extends the shielded to pool to only allow for transactions from
	users who maintain membership within a cross-chain Semaphore identity set.

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
contract IdentityVAnchor is VAnchorTree {
	using SafeERC20 for IERC20;

	ISemaphoreGroups SemaphoreContract;
	uint256 public immutable groupId; // Assumes group is already setup on the semaphore contract

	/**
		@notice The Identity VAnchor constructor
		@param _semaphore The address of Semaphore contract
		@param _verifier The address of SNARK verifier for this contract
		@param _hasher The address of the hasher for this contract
		@param _levels The height/# of levels of underlying Merkle Tree
		@param _handler The address of AnchorHandler for this contract
		@param _token The address of the token that is used to pay the deposit
		@param _maxEdges The maximum number of edges in the LinkableAnchor + Verifier supports.
		@notice The `_maxEdges` is zero-knowledge circuit dependent, meaning the
		`_verifier` ONLY supports a certain maximum # of edges. Therefore we need to
		limit the size of the LinkableAnchor with this parameter.
	*/
	constructor(
		ISemaphoreGroups _semaphore,
		IAnchorVerifier _verifier,
		IHasher _hasher,
		uint8 _levels,
		address _handler,
		address _token,
		uint8 _maxEdges,
		uint256 _groupId
	) VAnchorTree(_verifier, _levels, _hasher, _handler, _token, _maxEdges) {
		SemaphoreContract = _semaphore;
		groupId = _groupId;
	}

	/// @inheritdoc ZKVAnchorBase
	function _executeVerification(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		PublicInputs memory _publicInputs,
		Encryptions memory
	) internal view override {
		require(
			_publicInputs.inputNullifiers.length == 2 || _publicInputs.inputNullifiers.length == 16,
			"Invalid number of inputs"
		);
		bool smallInputs = _publicInputs.inputNullifiers.length == 2;
		(bytes memory encodedInput, uint256[] memory roots) = smallInputs
			? IdentityVAnchorEncodeInputs._encodeInputs2(_publicInputs, _auxPublicInputs, maxEdges)
			: IdentityVAnchorEncodeInputs._encodeInputs16(
				_publicInputs,
				_auxPublicInputs,
				maxEdges
			);

		require(
			SemaphoreContract.verifyRoots(groupId, _publicInputs.extensionRoots),
			"Invalid identity roots"
		);
		require(isValidRoots(roots), "Invalid vanchor roots");
		require(verify(_proof, encodedInput, smallInputs, maxEdges), "Invalid transaction proof");
	}
}
