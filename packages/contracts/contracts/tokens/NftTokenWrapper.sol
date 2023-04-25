/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../utils/Initialized.sol";
import "../utils/ProposalNonceTracker.sol";

/**
    @title A MultiTokenManager manages FungibleTokenWrapper systems using an external `governor` address
    @author Webb Technologies.
 */
contract NftTokenWrapper is
	ERC1155,
	ERC1155Receiver,
	IERC721Receiver,
	Initialized,
	ProposalNonceTracker,
	ReentrancyGuard
{
	using SafeMath for uint256;
	address public handler;

	constructor(string memory _uri) ERC1155(_uri) {}

	/**
        @notice Initializes the contract
        @param _handler The address of the token handler contract
     */
	function initialize(address _handler) external nonReentrant onlyUninitialized {
		require(_handler != address(0), "Handler address can't be 0");
		initialized = true;
		handler = _handler;
	}

	function wrap721(uint256 _tokenId, address _tokenContract) external nonReentrant {
		IERC721(_tokenContract).safeTransferFrom(msg.sender, address(this), _tokenId);
	}

	function unwrap721(uint256 _tokenId, address _tokenContract) external nonReentrant {
		// Ensure msg.sender is the owner of the wrapped token
		require(
			balanceOf(msg.sender, _tokenId) == 1,
			"NftTokenWrapper: Not the owner of the token"
		);
		// Ensure this contract is the owner of the token
		require(
			IERC721(_tokenContract).ownerOf(_tokenId) == address(this),
			"NftTokenWrapper: Not the owner of the wrapped token"
		);
		IERC721(_tokenContract).safeTransferFrom(address(this), msg.sender, _tokenId);
		_burn(msg.sender, _tokenId, 1);
	}

	function wrap1155(uint256 _tokenId, address _tokenContract) external nonReentrant {
		IERC1155(_tokenContract).safeTransferFrom(msg.sender, address(this), _tokenId, 1, "");
	}

	function unwrap1155(uint256 _tokenId, address _tokenContract) external nonReentrant {
		// Ensure msg.sender is the owner of the wrapped token
		require(
			balanceOf(msg.sender, _tokenId) == 1,
			"NftTokenWrapper: Not the owner of the token"
		);
		// Ensure this contract is the owner of the token
		require(
			IERC1155(_tokenContract).balanceOf(address(this), _tokenId) == 1,
			"NftTokenWrapper: Not the owner of the wrapped token"
		);
		IERC1155(_tokenContract).safeTransferFrom(address(this), msg.sender, _tokenId, 1, "");
		_burn(msg.sender, _tokenId, 1);
	}

	/**
	 * @dev Hook that is called before any token transfer. This includes minting
	 * and burning, as well as batched variants.
	 *
	 * The same hook is called on both single and batched variants. For single
	 * transfers, the length of the `ids` and `amounts` arrays will be 1.
	 *
	 * Calling conditions (for each `id` and `amount` pair):
	 *
	 * - When `from` and `to` are both non-zero, `amount` of ``from``'s tokens
	 * of token type `id` will be  transferred to `to`.
	 * - When `from` is zero, `amount` tokens of token type `id` will be minted
	 * for `to`.
	 * - when `to` is zero, `amount` of ``from``'s tokens of token type `id`
	 * will be burned.
	 * - `from` and `to` are never both zero.
	 * - `ids` and `amounts` have the same, non-zero length.
	 *
	 * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
	 */
	function _beforeTokenTransfer(
		address operator,
		address from,
		address to,
		uint256[] memory ids,
		uint256[] memory amounts,
		bytes memory data
	) internal virtual override {}

	/**
	 * @dev Hook that is called after any token transfer. This includes minting
	 * and burning, as well as batched variants.
	 *
	 * The same hook is called on both single and batched variants. For single
	 * transfers, the length of the `id` and `amount` arrays will be 1.
	 *
	 * Calling conditions (for each `id` and `amount` pair):
	 *
	 * - When `from` and `to` are both non-zero, `amount` of ``from``'s tokens
	 * of token type `id` will be  transferred to `to`.
	 * - When `from` is zero, `amount` tokens of token type `id` will be minted
	 * for `to`.
	 * - when `to` is zero, `amount` of ``from``'s tokens of token type `id`
	 * will be burned.
	 * - `from` and `to` are never both zero.
	 * - `ids` and `amounts` have the same, non-zero length.
	 *
	 * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
	 */
	function _afterTokenTransfer(
		address operator,
		address from,
		address to,
		uint256[] memory ids,
		uint256[] memory amounts,
		bytes memory data
	) internal virtual override {}

	/**
	 * @dev Handles the receipt of a single ERC1155 token type. This function is
	 * called at the end of a `safeTransferFrom` after the balance has been updated.
	 *
	 * NOTE: To accept the transfer, this must return
	 * `bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))`
	 * (i.e. 0xf23a6e61, or its own function selector).
	 *
	 * @param operator The address which initiated the transfer (i.e. msg.sender)
	 * @param from The address which previously owned the token
	 * @param id The ID of the token being transferred
	 * @param value The amount of tokens being transferred
	 * @param data Additional data with no specified format
	 * @return `bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))` if transfer is allowed
	 */
	function onERC1155Received(
		address operator,
		address from,
		uint256 id,
		uint256 value,
		bytes calldata data
	) external override returns (bytes4) {
		_mint(from, id, value, data);
		return this.onERC1155Received.selector;
	}

	/**
	 * @dev Handles the receipt of a multiple ERC1155 token types. This function
	 * is called at the end of a `safeBatchTransferFrom` after the balances have
	 * been updated.
	 *
	 * NOTE: To accept the transfer(s), this must return
	 * `bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`
	 * (i.e. 0xbc197c81, or its own function selector).
	 *
	 * @param operator The address which initiated the batch transfer (i.e. msg.sender)
	 * @param from The address which previously owned the token
	 * @param ids An array containing ids of each token being transferred (order and length must match values array)
	 * @param values An array containing amounts of each token being transferred (order and length must match ids array)
	 * @param data Additional data with no specified format
	 * @return `bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))` if transfer is allowed
	 */
	function onERC1155BatchReceived(
		address operator,
		address from,
		uint256[] calldata ids,
		uint256[] calldata values,
		bytes calldata data
	) external override returns (bytes4) {
		for (uint256 i = 0; i < ids.length; i++) {
			_mint(from, ids[i], values[i], data);
		}
		return this.onERC1155BatchReceived.selector;
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
		_mint(from, tokenId, 1, data);
		return this.onERC721Received.selector;
	}

	/**
	 * @dev Implementation of the {IERC165} interface.
	 *
	 * Contracts that want to implement ERC165 should inherit from this contract and override {supportsInterface} to check
	 * for the additional interface id that will be supported. For example:
	 *
	 * ```solidity
	 * function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
	 *     return interfaceId == type(MyInterface).interfaceId || super.supportsInterface(interfaceId);
	 * }
	 * ```
	 *
	 * Alternatively, {ERC165Storage} provides an easier to use but more expensive implementation.
	 */
	function supportsInterface(
		bytes4 interfaceId
	) public view virtual override(ERC1155, ERC1155Receiver) returns (bool) {
		return
			interfaceId == type(IERC1155Receiver).interfaceId ||
			super.supportsInterface(interfaceId);
	}
}
