// Copyright (c) 2018 @HarryR
// Copyright (c) 2018 @yondonfu
// License: LGPL-3.0+
/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.5;

import "./ModArith.sol";

library ETEC {
	/**
	 * Extended twisted edwards coordinates to extended affine coordinates
	 */
	function etecToPoint(
		uint256[4] memory point,
		uint256 Q
	) internal view returns (uint256, uint256) {
		uint256 inv_z = ModArith.inv(point[3], Q);
		return (mulmod(point[0], inv_z, Q), mulmod(point[1], inv_z, Q));
	}

	/**
	 * Project X,Y point to extended twisted edwards coordinates
	 */
	function pointToEtec(uint256 X, uint256 Y, uint256 Q, uint256[4] memory output) internal pure {
		output[0] = X;
		output[1] = Y;
		output[2] = mulmod(X, Y, Q);
		output[3] = 1;
	}

	function etecNegate(
		uint256[4] memory input_point,
		uint256[4] memory output_point,
		uint256 Q
	) internal pure {
		output_point[0] = Q - input_point[0];
		output_point[1] = input_point[1];
		output_point[2] = Q - input_point[2];
		output_point[3] = input_point[3];
	}

	/**
	 * @dev Double an ETEC point on the Baby-JubJub curve
	 * Using the `dbl-2008-hwcd` method
	 * https://www.hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#doubling-dbl-2008-hwcd
	 */
	function etecDouble(
		uint256[4] memory _p1,
		uint256[4] memory p2,
		uint256 localQ,
		uint256 localA
	) internal pure {
		assembly {
			//let localA := 0x292FC
			//let localQ := 0x30644E72E131A029B85045B68181585D2833E84879B9709143E1F593F0000001
			let x := mload(_p1)
			let y := mload(add(_p1, 0x20))
			// T, is not used
			let z := mload(add(_p1, 0x60))

			// a = self.x * self.x
			let a := mulmod(x, x, localQ)

			// b = self.y * self.y
			let b := mulmod(y, y, localQ)

			// t0 = self.z * self.z
			// c = t0 * 2
			let c := mulmod(mulmod(z, z, localQ), 2, localQ)

			// d = JUBJUB_A * a
			let d := mulmod(localA, a, localQ)

			// t1 = self.x + self.y
			let e := addmod(x, y, localQ)
			// t2 = t1 * t1
			// t3 = t2 - a
			// e = t3 - b
			e := addmod(
				addmod(mulmod(e, e, localQ), sub(localQ, a), localQ),
				sub(localQ, b),
				localQ
			)

			// g = d + b
			let g := addmod(d, b, localQ)

			// f = g - c
			let f := addmod(g, sub(localQ, c), localQ)

			// h = d - b
			let h := addmod(d, sub(localQ, b), localQ)

			// x3 <- E * F
			mstore(p2, mulmod(e, f, localQ))
			// y3 <- G * H
			mstore(add(p2, 0x20), mulmod(g, h, localQ))
			// t3 <- E * H
			mstore(add(p2, 0x40), mulmod(e, h, localQ))
			// z3 <- F * G
			mstore(add(p2, 0x60), mulmod(f, g, localQ))
		}
	}

	/**
	 * @dev Add 2 etec points on baby jubjub curve
	 * x3 = (x1y2 + y1x2) * (z1z2 - dt1t2)
	 * y3 = (y1y2 - ax1x2) * (z1z2 + dt1t2)
	 * t3 = (y1y2 - ax1x2) * (x1y2 + y1x2)
	 * z3 = (z1z2 - dt1t2) * (z1z2 + dt1t2)
	 */
	function etecAdd(
		uint256[4] memory _p1,
		uint256[4] memory _p2,
		uint256[4] memory p3,
		uint256 localQ,
		uint256 localA,
		uint256 localD
	) internal pure {
		assembly {
			//let localQ := 0x30644E72E131A029B85045B68181585D2833E84879B9709143E1F593F0000001
			//let y1 := mload(add(_p1, 0x20))
			//let y2 := mload(add(_p2, 0x20))
			//let localA := 0x292FC
			//let localD := 0x292F8

			// A <- x1 * x2
			let a := mulmod(mload(_p1), mload(_p2), localQ)

			// B <- y1 * y2
			let b := mulmod(mload(add(_p1, 0x20)), mload(add(_p2, 0x20)), localQ)

			// C <- d * t1 * t2
			let c := mulmod(
				mulmod(localD, mload(add(_p1, 0x40)), localQ),
				mload(add(_p2, 0x40)),
				localQ
			)

			// D <- z1 * z2
			let d := mulmod(mload(add(_p1, 0x60)), mload(add(_p2, 0x60)), localQ)

			// E <- (x1 + y1) * (x2 + y2) - A - B
			let e := addmod(
				mulmod(
					addmod(mload(_p1), mload(add(_p1, 0x20)), localQ),
					addmod(mload(_p2), mload(add(_p2, 0x20)), localQ),
					localQ
				),
				addmod(sub(localQ, a), sub(localQ, b), localQ),
				localQ
			)

			// F <- D - C
			let f := addmod(d, sub(localQ, c), localQ)

			// G <- D + C
			let g := addmod(d, c, localQ)

			// H <- B - a * A
			let h := addmod(b, sub(localQ, mulmod(localA, a, localQ)), localQ)

			// x3 <- E * F
			mstore(p3, mulmod(e, f, localQ))
			// y3 <- G * H
			mstore(add(p3, 0x20), mulmod(g, h, localQ))
			// t3 <- E * H
			mstore(add(p3, 0x40), mulmod(e, h, localQ))
			// z3 <- F * G
			mstore(add(p3, 0x60), mulmod(f, g, localQ))
		}
	}
}
