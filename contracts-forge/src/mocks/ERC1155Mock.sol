// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract ERC1155Mock is ERC1155("token/{id}.json") {
	function mint(address to, uint256 id, uint256 amount, bytes memory data) public {
		_mint(to, id, amount, data);
	}
}
