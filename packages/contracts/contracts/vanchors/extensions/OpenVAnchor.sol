/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../base/VAnchorBase.sol";
import "../../trees/MerkleTree.sol";
import "../../structs/SingleAssetExtData.sol";

/**
	@title Open Variable Anchor contract
	@author Webb Technologies
	@notice The Open Variable Anchor is a variable-denominated public pool system
	derived from Webb's VAnchorBase. This system extends the anchor protocol
	in a public way by enabling public cross-chain asset transfers.

	The system requires users to supply all inputs in the clear. Commitments are constructed
	inside of the smart contract and inserted into a merkle tree for easy cross-chain state updates.
 */
contract OpenVAnchor is VAnchorBase, MerkleTree {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;
	address public immutable token;

	constructor(
		IHasher _hasher,
		uint32 _levels,
		address _handler,
		address _token
	) VAnchorBase(_levels, _handler, 255) MerkleTree(_levels, _hasher) {
		token = _token;
	}

	function deposit(
		uint48 destinationChainId,
		uint256 depositAmount,
		address recipient,
		bytes calldata delegatedCalldata,
		uint256 blinding,
		uint256 relayingFee
	) public nonReentrant {
		require(
			depositAmount <= maximumDepositAmount,
			"amount is larger than maximumDepositAmount"
		);
		bytes32 commitment = keccak256(
			abi.encodePacked(
				destinationChainId,
				depositAmount,
				recipient,
				keccak256(delegatedCalldata),
				blinding,
				relayingFee
			)
		);
		// Send the wrapped asset directly to this contract.
		IERC20(token).transferFrom(msg.sender, address(this), depositAmount);
		// Insert the commitment
		_executeInsertion(uint256(commitment));
	}

	function wrapAndDeposit(
		uint48 destinationChainId,
		uint256 depositAmount,
		address recipient,
		bytes calldata delegatedCalldata,
		uint256 blinding,
		uint256 relayingFee,
		address tokenAddress
	) public payable nonReentrant {
		require(
			depositAmount <= maximumDepositAmount,
			"amount is larger than maximumDepositAmount"
		);
		bytes32 commitment = keccak256(
			abi.encodePacked(
				destinationChainId,
				depositAmount,
				recipient,
				keccak256(delegatedCalldata),
				blinding,
				relayingFee
			)
		);
		// Send the `tokenAddress` asset to the `TokenWrapper` and mint this contract the wrapped asset.
		_executeWrapping(tokenAddress, token, depositAmount);
		// Insert the commitment
		_executeInsertion(uint256(commitment));
	}

	function withdraw(
		uint256 withdrawAmount,
		address recipient,
		bytes memory delegatedCalldata,
		uint256 blinding,
		uint256 relayingFee,
		uint256[] memory merkleProof,
		uint32 commitmentIndex,
		uint256 root
	) public nonReentrant {
		bytes32 commitment = keccak256(
			abi.encodePacked(
				getChainIdType(),
				withdrawAmount,
				recipient,
				keccak256(delegatedCalldata),
				blinding,
				relayingFee
			)
		);
		require(
			_isValidMerkleProof(merkleProof, uint256(commitment), commitmentIndex, root),
			"Invalid Merkle Proof"
		);
		nullifierHashes[uint256(commitment)] = true;
		// Send the wrapped token to the recipient.
		_processWithdraw(token, recipient, withdrawAmount.sub(relayingFee));
		_processFee(token, msg.sender, relayingFee);
	}

	function withdrawAndUnwrap(
		uint256 withdrawAmount,
		address recipient,
		bytes memory delegatedCalldata,
		uint256 blinding,
		uint256 relayingFee,
		uint256[] memory merkleProof,
		uint32 commitmentIndex,
		uint256 root,
		address tokenAddress
	) public payable nonReentrant {
		bytes32 commitment = keccak256(
			abi.encodePacked(
				getChainIdType(),
				withdrawAmount,
				recipient,
				keccak256(delegatedCalldata),
				blinding,
				relayingFee
			)
		);
		require(
			_isValidMerkleProof(merkleProof, uint256(commitment), commitmentIndex, root),
			"Invalid Merkle Proof"
		);
		nullifierHashes[uint256(commitment)] = true;
		_withdrawAndUnwrap(token, tokenAddress, recipient, withdrawAmount.sub(relayingFee));
		_processFee(token, msg.sender, relayingFee);
	}

	function _executeInsertion(uint256 commitment) internal {
		insert(commitment);
		emit NewCommitment(commitment, 0, this.getNextIndex() - 1, "");
	}

	function _isValidMerkleProof(
		uint256[] memory siblingPathNodes,
		uint256 leaf,
		uint32 leafIndex,
		uint256 root
	) internal view returns (bool) {
		uint256 currNodeHash = leaf;
		uint32 nodeIndex = leafIndex;

		for (uint8 i = 0; i < siblingPathNodes.length; i++) {
			if (nodeIndex % 2 == 0) {
				currNodeHash = hashLeftRight(currNodeHash, siblingPathNodes[i]);
			} else {
				currNodeHash = hashLeftRight(siblingPathNodes[i], currNodeHash);
			}
			nodeIndex = nodeIndex / 2;
		}
		bool isKnownRootBool = false;
		for (uint i = 0; i < edgeList.length; i++) {
			isKnownRootBool = isKnownRootBool || isKnownNeighborRoot(edgeList[i].chainID, root);
		}
		isKnownRootBool = isKnownRootBool || this.isKnownRoot(root);
		return root == currNodeHash && isKnownRootBool;
	}
}
