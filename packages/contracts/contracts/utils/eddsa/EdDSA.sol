// Copyright (c) 2018 @HarryR
// License: LGPL-3.0+
/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.5;

import "./JubJub.sol";
import "../../hashers/IHasher.sol";

contract EdDSA {
	IHasher public hasher;

	constructor (IHasher _hasher) {
		hasher = _hasher;
	}

	function Verify(
		uint256[2] memory pubkey,
		uint256 hashed_msg,
		uint256[2] memory R,
		uint256 s
	) public view returns (bool) {
		uint256[2] memory B = JubJub.Generator();
		uint256[2] memory lhs;
		uint256[2] memory rhs;

		(lhs[0], lhs[1]) = JubJub.scalarMult(B[0], B[1], s);

		uint256 t = hasher.hash5([R[0], R[1], pubkey[0], pubkey[1], hashed_msg]);

		(rhs[0], rhs[1]) = JubJub.scalarMult(pubkey[0], pubkey[1], t * 8);
		rhs = JubJub.pointAdd([R[0], R[1]], [rhs[0], rhs[1]]);

		return lhs[0] == rhs[0] && lhs[1] == rhs[1];
	}
}
