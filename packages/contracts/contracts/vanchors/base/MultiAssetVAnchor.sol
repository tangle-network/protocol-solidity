/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.5;

import "./ZKVAnchorBase.sol";
import "../../structs/MultiAssetExtData.sol";
import "../../libs/MASPVAnchorEncodeInputs.sol";
import "../../interfaces/tokens/IRegistry.sol";
import "../../trees/MerkleTree.sol";
import "../../interfaces/tokens/INftTokenWrapper.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../../interfaces/IBatchTree.sol";
import "../../interfaces/IMASPProxy.sol";
import "../../libs/SwapEncodeInputs.sol";
import "../../interfaces/verifiers/ISwapVerifier.sol";

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

	Part of the benefit of a MASP is the ability to handle multiple assets in a single pool.
	To support this, the system uses a `assetId` field in the UTXO to identify the asset.
	One thing to remember is that all assets in the pool must be wrapped ERC20 tokens specific
	to the pool. We refer to this tokens as the bridge ERC20 tokens. Part of the challenge of building
	the MASP then is dealing with the mapping between bridge ERC20s and their asset IDs.

	IMPORTANT: A bridge ERC20 token MUST have the same assetID across chain.
 */
abstract contract MultiAssetVAnchor is ZKVAnchorBase {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;

	address public registry;
	address public rewardUnspentTree;
	address public rewardSpentTree;
	address proxy;
	uint256 allowableSwapTimestampEpsilon = 1 minutes;
	address swapVerifier;

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
		IRegistry _registry,
		IBatchTree _rewardUnspentTree,
		IBatchTree _rewardSpentTree,
		IMASPProxy _proxy,
		IAnchorVerifier _verifier,
		ISwapVerifier _swapVerifier,
		uint32 _levels,
		address _handler,
		uint8 _maxEdges
	) ZKVAnchorBase(_verifier, _levels, _handler, _maxEdges) {
		registry = address(_registry);
		rewardUnspentTree = address(_rewardUnspentTree);
		rewardSpentTree = address(_rewardSpentTree);
		proxy = address(_proxy);
		swapVerifier = address(_swapVerifier);
	}

	/**
		@notice Wraps and deposits in a single flow without a proof. Leads to a single non-zero UTXO.
		@param _fromTokenAddress The address of the token to wrap from. If address(0) then do not wrap.
		@param _toTokenAddress The address of the token to wrap into
		@param _amount The amount of tokens to wrap
		@param partialCommitment The partial commitment of the UTXO
		@param encryptedCommitment The encrypted commitment of the partial UTXO
	 */
	function depositERC20(
		address _fromTokenAddress,
		address _toTokenAddress,
		uint256 _amount,
		bytes32 partialCommitment,
		bytes memory encryptedCommitment
	) public payable {
		uint256 amount = _amount;
		// Execute wrapping if wrapAndDeposit, otherwise directly transfer wrapped tokens.
		if (_fromTokenAddress != address(0)) {
			amount = _executeWrapping(_fromTokenAddress, _toTokenAddress, _amount);
		} else {
			IMintableERC20(_toTokenAddress).transferFrom(
				msg.sender,
				address(this),
				uint256(amount)
			);
		}
		// Create the record commitment
		uint256 assetID = IRegistry(registry).getAssetIdFromWrappedAddress(_toTokenAddress);
		require(assetID != 0, "Wrapped asset not registered");
		uint256 commitment = IHasher(this.getHasher()).hash4(
			[assetID, 0, amount, uint256(partialCommitment)]
		);
		_insertTwo(commitment, 0);
		emit NewCommitment(commitment, 0, this.getNextIndex() - 2, encryptedCommitment);
	}

	/**
		@notice Wraps and deposits in a single flow without a proof. Leads to a single non-zero UTXO.
		@param _fromTokenAddress The address of the token to wrap from. If address(0) do not wrap.
		@param _toTokenAddress The address of the token to wrap into
		@param _tokenID Nft token ID
		@param partialCommitment The partial commitment of the UTXO
		@param encryptedCommitment The encrypted commitment of the partial UTXO
	 */
	function depositERC721(
		address _fromTokenAddress,
		address _toTokenAddress,
		uint256 _tokenID,
		bytes32 partialCommitment,
		bytes memory encryptedCommitment
	) public payable {
		// Execute the wrapping
		uint256 assetID = IRegistry(registry).getAssetIdFromWrappedAddress(_toTokenAddress);
		// Check assetID is not 0
		require(assetID != 0, "Wrapped asset not registered");
		if (_fromTokenAddress != address(0)) {
			// Check wrapped and unwrapped addresses are consistent
			require(
				IRegistry(registry).getUnwrappedAssetAddress(assetID) == _fromTokenAddress,
				"Wrapped and unwrapped addresses don't match"
			);
			INftTokenWrapper(_toTokenAddress).wrap721(_tokenID, _fromTokenAddress);
		} else {
			IERC721(_toTokenAddress).safeTransferFrom(msg.sender, address(this), _tokenID);
		}
		// Create the record commitment
		uint256 commitment = IHasher(this.getHasher()).hash4(
			[assetID, _tokenID, 1, uint256(partialCommitment)]
		);
		_insertTwo(commitment, 0);
		emit NewCommitment(commitment, 0, this.getNextIndex() - 2, encryptedCommitment);
	}

	/// @inheritdoc ZKVAnchorBase
	function transact(
		bytes memory _proof,
		bytes memory _auxPublicInputs,
		CommonExtData memory _externalData,
		PublicInputs memory _publicInputs,
		Encryptions memory _encryptions
	) public payable virtual override {
		MASPAuxPublicInputs memory aux = abi.decode(_auxPublicInputs, (MASPAuxPublicInputs));
		address wrappedToken = IRegistry(registry).getWrappedAssetAddress(aux.publicAssetID);
		_transact(
			wrappedToken,
			_proof,
			_auxPublicInputs,
			_externalData,
			_publicInputs,
			_encryptions
		);
		uint256 timestamp = block.timestamp;
		for (uint256 i = 0; i < _publicInputs.inputNullifiers.length; i++) {
			IMASPProxy(proxy).queueRewardSpentTreeCommitment(
				bytes32(
					IHasher(this.getHasher()).hashLeftRight(
						_publicInputs.inputNullifiers[i],
						timestamp
					)
				)
			);
		}
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
	) internal virtual override returns (bytes32) {
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

	function swap(
		bytes memory proof,
		SwapPublicInputs memory _publicInputs,
		Encryptions memory aliceEncryptions,
		Encryptions memory bobEncryptions
	) public {
		// Verify the proof
		(bytes memory encodedInputs, uint256[] memory roots) = SwapEncodeInputs._encodeInputs(
			_publicInputs,
			maxEdges
		);
		require(isValidRoots(roots), "Invalid vanchor roots");
		require(
			ISwapVerifier(swapVerifier).verifySwap(proof, encodedInputs, maxEdges),
			"Invalid swap proof"
		);
		// Nullify the spent Records
		nullifierHashes[_publicInputs.aliceSpendNullifier] = true;
		nullifierHashes[_publicInputs.bobSpendNullifier] = true;
		emit NewNullifier(_publicInputs.aliceSpendNullifier);
		emit NewNullifier(_publicInputs.bobSpendNullifier);
		IMASPProxy(proxy).queueRewardSpentTreeCommitment(
			bytes32(
				IHasher(this.getHasher()).hashLeftRight(
					_publicInputs.aliceSpendNullifier,
					block.timestamp
				)
			)
		);
		IMASPProxy(proxy).queueRewardSpentTreeCommitment(
			bytes32(
				IHasher(this.getHasher()).hashLeftRight(
					_publicInputs.bobSpendNullifier,
					block.timestamp
				)
			)
		);
		// Check block timestamp versus timestamps in swap
		require(
			(block.timestamp - allowableSwapTimestampEpsilon <= _publicInputs.currentTimestamp) &&
				(_publicInputs.currentTimestamp <= block.timestamp + allowableSwapTimestampEpsilon),
			"Current timestamp not valid"
		);
		// Add new Records from swap (receive and change records) to Record Merkle tree.
		// Insert Alice's Change and Receive Records
		_insertTwo(_publicInputs.aliceChangeRecord, _publicInputs.aliceReceiveRecord);
		emit NewCommitment(
			_publicInputs.aliceChangeRecord,
			0,
			this.getNextIndex() - 2,
			aliceEncryptions.encryptedOutput1
		);
		emit NewCommitment(
			_publicInputs.aliceReceiveRecord,
			0,
			this.getNextIndex() - 1,
			aliceEncryptions.encryptedOutput2
		);
		// Insert Bob's Change and Receive Records
		_insertTwo(_publicInputs.bobChangeRecord, _publicInputs.bobReceiveRecord);
		emit NewCommitment(
			_publicInputs.bobChangeRecord,
			0,
			this.getNextIndex() - 2,
			bobEncryptions.encryptedOutput1
		);
		emit NewCommitment(
			_publicInputs.bobReceiveRecord,
			0,
			this.getNextIndex() - 1,
			bobEncryptions.encryptedOutput2
		);
		IMASPProxy(proxy).queueRewardSpentTreeCommitment(
			bytes32(
				IHasher(this.getHasher()).hashLeftRight(
					_publicInputs.aliceChangeRecord,
					block.timestamp
				)
			)
		);
		IMASPProxy(proxy).queueRewardSpentTreeCommitment(
			bytes32(
				IHasher(this.getHasher()).hashLeftRight(
					_publicInputs.aliceReceiveRecord,
					block.timestamp
				)
			)
		);
		IMASPProxy(proxy).queueRewardSpentTreeCommitment(
			bytes32(
				IHasher(this.getHasher()).hashLeftRight(
					_publicInputs.bobChangeRecord,
					block.timestamp
				)
			)
		);
		IMASPProxy(proxy).queueRewardSpentTreeCommitment(
			bytes32(
				IHasher(this.getHasher()).hashLeftRight(
					_publicInputs.bobReceiveRecord,
					block.timestamp
				)
			)
		);
	}
}
