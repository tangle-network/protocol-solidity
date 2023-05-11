/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@webb-tools/protocol-solidity/utils/Initialized.sol";
import "@webb-tools/protocol-solidity/utils/ProposalNonceTracker.sol";

/**
    @title A MultiTokenManager manages FungibleTokenWrapper systems using an external `governor` address
    @author Webb Technologies.
 */
contract NftTokenWrapper is ERC721, IERC721Receiver, Initialized, ProposalNonceTracker {
	address public handler;
	address unwrappedNftAddress;

	constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

	/**
        @notice Initializes the contract
        @param _handler The address of the token handler contract
     */
	function initialize(address _handler, address _unwrappedNftAddress) external onlyUninitialized {
		initialized = true;
		handler = _handler;
		unwrappedNftAddress = _unwrappedNftAddress;
	}

	function wrap721(address masp, uint256 _tokenId) external {
		IERC721(unwrappedNftAddress).safeTransferFrom(msg.sender, address(this), _tokenId);
		_mint(masp, _tokenId);
	}

	function unwrap721(uint256 _tokenId, address _tokenContract) external {
		// Ensure msg.sender is the owner of the wrapped token
		require(unwrappedNftAddress == _tokenContract, "Wrong unwrapped NFT address");
		require(_ownerOf(_tokenId) == msg.sender, "NftTokenWrapper: Not the owner of the token");
		// Ensure this contract is the owner of the token
		require(
			IERC721(_tokenContract).ownerOf(_tokenId) == address(this),
			"NftTokenWrapper: Not the owner of the unwrapped token"
		);
		IERC721(_tokenContract).safeTransferFrom(address(this), msg.sender, _tokenId);
		_burn(_tokenId);
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
		address,
		address,
		uint256,
		bytes calldata
	) external pure override returns (bytes4) {
		return this.onERC721Received.selector;
	}
}
