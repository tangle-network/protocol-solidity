/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC721Mintable is ERC721 {
	constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

	function mint(address account, uint256 tokenId) public {
		_mint(account, tokenId);
	}
}
