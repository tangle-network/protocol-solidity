/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ERC721Mintable is ERC721 {
	using Counters for Counters.Counter;
	Counters.Counter private _tokenId;

	constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

	function mint(address account) public {
		_tokenId.increment();
		_mint(account, _tokenId.current());
	}
}
