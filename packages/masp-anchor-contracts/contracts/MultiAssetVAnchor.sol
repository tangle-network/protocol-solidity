/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@webb-tools/protocol-solidity/vanchors/base/ZKVAnchorBase.sol";
import "@webb-tools/protocol-solidity/trees/MerkleTree.sol";
import "./MASPVAnchorEncodeInputs.sol";
import "./interfaces/IRegistry.sol";
import "./interfaces/INftTokenWrapper.sol";
import "./interfaces/IBatchTree.sol";
import "./interfaces/IMASPProxy.sol";
import "./interfaces/ISwapVerifier.sol";
import "./MultiAssetExtData.sol";
import "./SwapEncodeInputs.sol";

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
abstract contract MultiAssetVAnchor is ZKVAnchorBase, IERC721Receiver {
	using SafeERC20 for IERC20;

	address public registry;
	address proxy;
	uint256 allowableSwapTimestampEpsilon = 60_000;
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
		IMASPProxy _proxy,
		IAnchorVerifier _verifier,
		ISwapVerifier _swapVerifier,
		uint32 _levels,
		address _handler,
		uint8 _maxEdges
	) ZKVAnchorBase(_verifier, _levels, _handler, _maxEdges) {
		registry = address(_registry);
		proxy = address(_proxy);
		swapVerifier = address(_swapVerifier);
	}

	function _executeAuxInsertions(
		uint256[2] memory feeOutputCommitments,
		Encryptions memory _feeEncryptions
	) internal virtual;

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
		uint256 publicTokenID = aux.publicTokenID;
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
		for (uint256 i = 0; i < _publicInputs.outputCommitments.length; i++) {
			IMASPProxy(proxy).queueRewardUnspentTreeCommitment(
				address(this),
				bytes32(
					IHasher(this.getHasher()).hashLeftRight(
						_publicInputs.outputCommitments[i],
						timestamp
					)
				)
			);
		}
		for (uint256 i = 0; i < aux.feeOutputCommitments.length; i++) {
			IMASPProxy(proxy).queueRewardUnspentTreeCommitment(
				address(this),
				bytes32(
					IHasher(this.getHasher()).hashLeftRight(aux.feeOutputCommitments[i], timestamp)
				)
			);
		}
		_executeAuxInsertions(aux.feeOutputCommitments, _encryptions);
	}

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
	) internal virtual override {
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
			MASPAuxPublicInputs memory aux = abi.decode(_auxPublicInputs, (MASPAuxPublicInputs));
			if (_externalData.token == _wrappedToken) {
				if (aux.publicTokenID == 0) {
					_processWithdraw(
						_wrappedToken,
						_externalData.recipient,
						uint256(-_externalData.extAmount)
					);
				} else {
					_processWithdrawERC721(
						_wrappedToken,
						_externalData.recipient,
						aux.publicTokenID
					);
				}
			} else {
				if (aux.publicTokenID == 0) {
					_withdrawAndUnwrap(
						_wrappedToken,
						_externalData.token,
						_externalData.recipient,
						uint256(-_externalData.extAmount)
					);
				} else {
					_withdrawAndUnwrapERC721(
						_wrappedToken,
						_externalData.token,
						_externalData.recipient,
						aux.publicTokenID
					);
				}
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
		_executeAuxInsertions(
			[_publicInputs.aliceChangeRecord, _publicInputs.aliceReceiveRecord],
			aliceEncryptions
		);
		// Insert Bob's Change and Receive Records
		_executeAuxInsertions(
			[_publicInputs.bobChangeRecord, _publicInputs.bobReceiveRecord],
			bobEncryptions
		);
	}

	function _processWithdrawERC721(
		address _token,
		address _recipient,
		uint256 publicTokenID
	) internal virtual {
		address owner = IERC721(_token).ownerOf(publicTokenID);
		if (owner == address(this)) {
			// transfer tokens when balance exists
			IERC721(_token).safeTransferFrom(address(this), _recipient, publicTokenID);
		} else {
			// mint tokens when not enough balance exists
			INftTokenWrapper(_token).mint(_recipient, publicTokenID);
		}
	}

	function _withdrawAndUnwrapERC721(
		address _fromTokenAddress,
		address _toTokenAddress,
		address _recipient,
		uint256 publicTokenID
	) internal virtual {
		_processWithdrawERC721(_fromTokenAddress, address(this), publicTokenID);

		INftTokenWrapper(_fromTokenAddress).unwrap721(publicTokenID, _toTokenAddress);
	}

	/**
	 * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
	 * by `operator` from `from`, this function is called.
	 *
	 * It must return its Solidity selector to confirm the token transfer.
	 * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
	 *
	 * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
	 */
	function onERC721Received(
		address operator,
		address from,
		uint256 tokenId,
		bytes calldata data
	) external override returns (bytes4) {
		return this.onERC721Received.selector;
	}
}
