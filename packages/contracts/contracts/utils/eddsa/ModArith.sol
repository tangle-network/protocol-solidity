// Copyright (c) 2018-2019 @HarryR
// License: LGPL-3.0+
/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.5;

library ModArith {
	function modexp(
		uint256 base,
		uint256 exponent,
		uint256 modulus
	) internal view returns (uint256) {
		uint256[1] memory output;
		uint256[6] memory input;
		input[0] = 0x20;
		input[1] = 0x20;
		input[2] = 0x20;
		input[3] = base;
		input[4] = exponent;
		input[5] = modulus;

		bool success;
		assembly {
			success := staticcall(sub(gas(), 2000), 5, input, 0xc0, output, 0x20)
		}
		require(success);
		return output[0];
	}

	function inv(uint256 value, uint256 field_modulus) internal view returns (uint256) {
		return modexp(value, field_modulus - 2, field_modulus);
	}
}
