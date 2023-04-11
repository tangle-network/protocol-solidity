// Copyright (c) 2018 @HarryR
// License: LGPL-3.0+
/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.5;

library wNAF {
	/**
	 * Note the result is stored as 256 bytes, encoded as 8x 256-bit words
	 * This prevents solidity from giving us a 20k gas overhead for memory allocation...
	 *
	 * This maps to an array of bytes, instead of a signed integer of ±(0..(2^w)-1))
	 * we have a range of (0..2^w) which maps directly into a 0-indexed table for the
	 * point to use for addition. This avoids signed integers entirely.
	 *
	 * The function returns the offset (in bytes) to start from within the result
	 */
	function wnafSequence(
		uint256 value,
		uint256 width,
		uint256[8] memory result
	) internal pure returns (uint256 out_offs) {
		uint a = 1 << width;
		uint b = a >> 1;
		uint k_i;
		assembly {
			a := shl(width, 1)
			b := shr(1, a)
			out_offs := add(result, 0xFF)

			for {

			} gt(value, 0) {

			} {
				k_i := 0
				if gt(mod(value, 2), 0) {
					k_i := mod(value, a)
					k_i := sub(k_i, mul(a, gt(k_i, b))) // slightly cheaper than an IF
					value := sub(value, k_i)
				}
				mstore8(out_offs, add(b, k_i))
				value := div(value, 2)
				out_offs := sub(out_offs, 1)
			}

			out_offs := sub(out_offs, result)
		}
	}
}
