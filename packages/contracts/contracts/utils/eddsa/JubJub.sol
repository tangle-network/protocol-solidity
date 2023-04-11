// Copyright (c) 2018 @HarryR
// Copyright (c) 2018 @yondonfu
// License: LGPL-3.0+
/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.5;

import "./ETEC.sol";
import "./wNAF.sol";

library JubJub {
	// A should be a square in Q
	uint256 public constant JUBJUB_A = 168700;

	// D should not be a square in Q
	uint256 public constant JUBJUB_D = 168696;

	uint256 public constant COFACTOR = 8;

	uint256 public constant Q =
		21888242871839275222246405745257275088548364400416034343698204186575808495617;

	// L * COFACTOR = Curve Order
	uint256 public constant L =
		2736030358979909402780800718157159386076813972158567259200215660948447373041;

	function Generator() internal pure returns (uint256[2] memory) {
		return [
			17777552123799933955779906779655732241715742912184938656739573121738514868268,
			2626589144620713026669568689430873010625803728049924121243784502389097019475
		];
	}

	/**
	 * Value values are: [-15, -13, -11, -9, -7, -5, -3, -1, 0, 1, 3, 5, 7, 9, 11, 13, 15]
	 * b = 16
	 * 8 point computations
	 * 8 point negations
	 */
	function wnafWindow5(uint256 x, uint256 y, uint256[4][32] memory w) internal pure {
		ETEC.pointToEtec(x, y, Q, w[17]);
		etecDouble(w[17], w[18]); // 2 = 1 + 1
		etecAdd(w[17], w[18], w[19]); // 3 = 2 + 1
		etecAdd(w[17], w[19], w[21]); // 5 = 2 + 3
		etecAdd(w[17], w[21], w[23]); // 7 = 2 + 5
		etecAdd(w[17], w[23], w[25]); // 9 = 2 + 7
		etecAdd(w[17], w[25], w[27]); // 11 = 2 + 9
		etecAdd(w[17], w[27], w[29]); // 13 = 2 + 11
		etecAdd(w[17], w[29], w[31]); // 15 = 2 + 13
		ETEC.etecNegate(w[31], w[1], Q);
		ETEC.etecNegate(w[29], w[3], Q);
		ETEC.etecNegate(w[27], w[5], Q);
		ETEC.etecNegate(w[25], w[7], Q);
		ETEC.etecNegate(w[23], w[9], Q);
		ETEC.etecNegate(w[21], w[11], Q);
		ETEC.etecNegate(w[19], w[13], Q);
		ETEC.etecNegate(w[17], w[15], Q);
	}

	function scalarMultNAF5(
		uint256 x,
		uint256 y,
		uint256 value
	) internal view returns (uint256, uint256) {
		uint256[4] memory r = [uint256(0), uint256(1), uint256(0), uint256(1)];

		uint256[4][1 << 5] memory w;
		wnafWindow5(x, y, w);

		uint256[8] memory wnaf_seq;
		uint256 wnaf_offset;
		wnaf_offset = wNAF.wnafSequence(value, 5, wnaf_seq);
		uint256 wnaf_item;
		uint256 wnaf_offset2 = wnaf_offset;

		assembly {
			wnaf_offset2 := add(wnaf_offset2, wnaf_seq)
		}

		while (wnaf_offset <= 0xFF) {
			assembly {
				wnaf_item := byte(0, mload(wnaf_offset2)) // There is no `mload8`
				wnaf_offset2 := add(wnaf_offset2, 1)
			}
			wnaf_offset += 1;

			etecDouble(r, r);
			if (wnaf_item != 0 && wnaf_item != 8) {
				etecAdd(r, w[wnaf_item], r);
			}
		}
		return ETEC.etecToPoint(r, Q);
	}

	function scalarMultNAF(
		uint256 x,
		uint256 y,
		uint256 value
	) internal view returns (uint256, uint256) {
		uint256[4] memory r = [uint256(0), uint256(1), uint256(0), uint256(1)];

		// Window, [-1, ?, 1]
		uint256[4][3] memory w;
		ETEC.pointToEtec(x, y, Q, w[2]);
		// Negate first point in window
		// Twisted Edwards Curves Revisited - HWCD, pg 5, section 3
		//  -(X : Y : T : Z) = (-X : Y : -T : Z)
		w[0] = [Q - x, y, Q - w[2][2], 1];

		uint256 booth_double = 2 * value;
		require(booth_double > value);
		uint256 a = 1 << 255;
		uint256 i = 0xFF;

		while (a != 0) {
			// Calculate a two-bit window of the Booth encoding (in right-to-left form)
			// See: https://eprint.iacr.org/2005/384.pdf
			int256 naf_a = int256((booth_double & a) >> i) - int256((value & a) >> i);
			a = a / 2;
			i -= 1;
			int256 naf_b = int256((booth_double & a) >> i) - int256((value & a) >> i);
			a = a / 2;
			i -= 1;

			if ((naf_a + naf_b) == 0) {
				naf_b = naf_a;
				naf_a = 0;
			}

			etecDouble(r, r);
			if (naf_a != 0) {
				etecAdd(r, w[uint256(1 + naf_a)], r);
			}

			etecDouble(r, r);
			if (naf_b != 0) {
				etecAdd(r, w[uint256(1 + naf_b)], r);
			}
		}
		return ETEC.etecToPoint(r, Q);
	}

	function scalarMult(
		uint256 x,
		uint256 y,
		uint256 value
	) internal view returns (uint256, uint256) {
		uint256[4] memory p;
		ETEC.pointToEtec(x, y, Q, p);

		uint256[4] memory a = [uint256(0), uint256(1), uint256(0), uint256(1)];

		while (value != 0) {
			if ((value & 1) != 0) {
				ETEC.etecAdd(a, p, a, Q, JUBJUB_A, JUBJUB_D);
			}

			ETEC.etecDouble(p, p, Q, JUBJUB_A);

			value = value / 2;
		}

		return ETEC.etecToPoint(a, Q);
	}

	function etecDouble(uint256[4] memory _p1, uint256[4] memory p2) internal pure {
		ETEC.etecDouble(_p1, p2, Q, JUBJUB_A);
	}

	/**
	 * @dev Add 2 etec points on baby jubjub curve
	 * x3 = (x1y2 + y1x2) * (z1z2 - dt1t2)
	 * y3 = (y1y2 - ax1x2) * (z1z2 + dt1t2)
	 * t3 = (y1y2 - ax1x2) * (x1y2 + y1x2)
	 * z3 = (z1z2 - dt1t2) * (z1z2 + dt1t2)
	 *
	 * XXX: This uses unsafe optimisations, using `add` rather than `addmod`
	 *      We can add 254 bit integers together without them overflowing the 256bit word
	 *      so they can be passed into another function which performs a modulo
	 *      This only works because the Baby JubJub field modulus is 254 bits.
	 */
	function etecAdd(
		uint256[4] memory _p1,
		uint256[4] memory _p2,
		uint256[4] memory p3
	) internal pure {
		ETEC.etecAdd(_p1, _p2, p3, Q, JUBJUB_A, JUBJUB_D);
	}

	function pointAdd(
		uint256[2] memory self,
		uint256[2] memory other
	) internal view returns (uint256[2] memory result_affine) {
		uint256[4] memory self_etec;
		uint256[4] memory other_etec;
		uint256[4] memory result_etec;
		ETEC.pointToEtec(self[0], self[1], Q, self_etec);
		ETEC.pointToEtec(other[0], other[1], Q, other_etec);
		ETEC.etecAdd(self_etec, other_etec, result_etec, Q, JUBJUB_A, JUBJUB_D);
		(result_affine[0], result_affine[1]) = ETEC.etecToPoint(result_etec, Q);
	}

	function pointDouble(
		uint256[2] memory point
	) internal view returns (uint256[2] memory result_affine) {
		uint256[4] memory point_etec;
		ETEC.pointToEtec(point[0], point[1], Q, point_etec);
		ETEC.etecDouble(point_etec, point_etec, Q, JUBJUB_A);
		(result_affine[0], result_affine[1]) = ETEC.etecToPoint(point_etec, Q);
	}
}
