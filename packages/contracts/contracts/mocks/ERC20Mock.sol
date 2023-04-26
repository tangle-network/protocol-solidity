/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20("DAIMock", "DAIM") {
	function mint(address account, uint256 amount) public {
		_mint(account, amount);
	}
}
