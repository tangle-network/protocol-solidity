//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// 2019 OKIMS
//      ported to solidity 0.6
//      fixed linter warnings
//      added requiere error messages
//
//
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

library Pairing {
	struct G1Point {
		uint X;
		uint Y;
	}
	// Encoding of field elements is: X[0] * z + X[1]
	struct G2Point {
		uint[2] X;
		uint[2] Y;
	}

	/// @return the generator of G1
	function P1() internal pure returns (G1Point memory) {
		return G1Point(1, 2);
	}

	/// @return the generator of G2
	function P2() internal pure returns (G2Point memory) {
		// Original code point
		return
			G2Point(
				[
					11559732032986387107991004021392285783925812861821192530917403151452391805634,
					10857046999023057135944570762232829481370756359578518086990519993285655852781
				],
				[
					4082367875863433681332203403145435568316851327593401208105741076214120093531,
					8495653923123431417604973247489272438418190587263600148770280649306958101930
				]
			);

		/*
        // Changed by Jordi point
        return G2Point(
            [10857046999023057135944570762232829481370756359578518086990519993285655852781,
             11559732032986387107991004021392285783925812861821192530917403151452391805634],
            [8495653923123431417604973247489272438418190587263600148770280649306958101930,
             4082367875863433681332203403145435568316851327593401208105741076214120093531]
        );
*/
	}

	/// @return r the negation of p, i.e. p.addition(p.negate()) should be zero.
	function negate(G1Point memory p) internal pure returns (G1Point memory r) {
		// The prime q in the base field F_q for G1
		uint q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
		if (p.X == 0 && p.Y == 0) return G1Point(0, 0);
		return G1Point(p.X, q - (p.Y % q));
	}

	/// @return r the sum of two points of G1
	function addition(
		G1Point memory p1,
		G1Point memory p2
	) internal view returns (G1Point memory r) {
		uint[4] memory input;
		input[0] = p1.X;
		input[1] = p1.Y;
		input[2] = p2.X;
		input[3] = p2.Y;
		bool success;
		// solium-disable-next-line security/no-inline-assembly
		assembly {
			success := staticcall(sub(gas(), 2000), 6, input, 0xc0, r, 0x60)
			// Use "invalid" to make gas estimation work
			switch success
			case 0 {
				invalid()
			}
		}
		require(success, "pairing-add-failed");
	}

	/// @return r the product of a point on G1 and a scalar, i.e.
	/// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
	function scalar_mul(G1Point memory p, uint s) internal view returns (G1Point memory r) {
		uint[3] memory input;
		input[0] = p.X;
		input[1] = p.Y;
		input[2] = s;
		bool success;
		// solium-disable-next-line security/no-inline-assembly
		assembly {
			success := staticcall(sub(gas(), 2000), 7, input, 0x80, r, 0x60)
			// Use "invalid" to make gas estimation work
			switch success
			case 0 {
				invalid()
			}
		}
		require(success, "pairing-mul-failed");
	}

	/// @return the result of computing the pairing check
	/// e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
	/// For example pairing([P1(), P1().negate()], [P2(), P2()]) should
	/// return true.
	function pairing(G1Point[] memory p1, G2Point[] memory p2) internal view returns (bool) {
		require(p1.length == p2.length, "pairing-lengths-failed");
		uint elements = p1.length;
		uint inputSize = elements * 6;
		uint[] memory input = new uint[](inputSize);
		for (uint i = 0; i < elements; i++) {
			input[i * 6 + 0] = p1[i].X;
			input[i * 6 + 1] = p1[i].Y;
			input[i * 6 + 2] = p2[i].X[0];
			input[i * 6 + 3] = p2[i].X[1];
			input[i * 6 + 4] = p2[i].Y[0];
			input[i * 6 + 5] = p2[i].Y[1];
		}
		uint[1] memory out;
		bool success;
		// solium-disable-next-line security/no-inline-assembly
		assembly {
			success := staticcall(
				sub(gas(), 2000),
				8,
				add(input, 0x20),
				mul(inputSize, 0x20),
				out,
				0x20
			)
			// Use "invalid" to make gas estimation work
			switch success
			case 0 {
				invalid()
			}
		}
		require(success, "pairing-opcode-failed");
		return out[0] != 0;
	}

	/// Convenience method for a pairing check for two pairs.
	function pairingProd2(
		G1Point memory a1,
		G2Point memory a2,
		G1Point memory b1,
		G2Point memory b2
	) internal view returns (bool) {
		G1Point[] memory p1 = new G1Point[](2);
		G2Point[] memory p2 = new G2Point[](2);
		p1[0] = a1;
		p1[1] = b1;
		p2[0] = a2;
		p2[1] = b2;
		return pairing(p1, p2);
	}

	/// Convenience method for a pairing check for three pairs.
	function pairingProd3(
		G1Point memory a1,
		G2Point memory a2,
		G1Point memory b1,
		G2Point memory b2,
		G1Point memory c1,
		G2Point memory c2
	) internal view returns (bool) {
		G1Point[] memory p1 = new G1Point[](3);
		G2Point[] memory p2 = new G2Point[](3);
		p1[0] = a1;
		p1[1] = b1;
		p1[2] = c1;
		p2[0] = a2;
		p2[1] = b2;
		p2[2] = c2;
		return pairing(p1, p2);
	}

	/// Convenience method for a pairing check for four pairs.
	function pairingProd4(
		G1Point memory a1,
		G2Point memory a2,
		G1Point memory b1,
		G2Point memory b2,
		G1Point memory c1,
		G2Point memory c2,
		G1Point memory d1,
		G2Point memory d2
	) internal view returns (bool) {
		G1Point[] memory p1 = new G1Point[](4);
		G2Point[] memory p2 = new G2Point[](4);
		p1[0] = a1;
		p1[1] = b1;
		p1[2] = c1;
		p1[3] = d1;
		p2[0] = a2;
		p2[1] = b2;
		p2[2] = c2;
		p2[3] = d2;
		return pairing(p1, p2);
	}
}

contract VerifierF2_16 {
	using Pairing for *;
	struct VerifyingKey {
		Pairing.G1Point alfa1;
		Pairing.G2Point beta2;
		Pairing.G2Point gamma2;
		Pairing.G2Point delta2;
		Pairing.G1Point[] IC;
	}
	struct Proof {
		Pairing.G1Point A;
		Pairing.G2Point B;
		Pairing.G1Point C;
	}

	function verifyingKey() internal pure returns (VerifyingKey memory vk) {
		vk.alfa1 = Pairing.G1Point(
			20491192805390485299153009773594534940189261866228447918068658471970481763042,
			9383485363053290200918347156157836566562967994039712273449902621266178545958
		);

		vk.beta2 = Pairing.G2Point(
			[
				4252822878758300859123897981450591353533073413197771768651442665752259397132,
				6375614351688725206403948262868962793625744043794305715222011528459656738731
			],
			[
				21847035105528745403288232691147584728191162732299865338377159692350059136679,
				10505242626370262277552901082094356697409835680220590971873171140371331206856
			]
		);
		vk.gamma2 = Pairing.G2Point(
			[
				11559732032986387107991004021392285783925812861821192530917403151452391805634,
				10857046999023057135944570762232829481370756359578518086990519993285655852781
			],
			[
				4082367875863433681332203403145435568316851327593401208105741076214120093531,
				8495653923123431417604973247489272438418190587263600148770280649306958101930
			]
		);
		vk.delta2 = Pairing.G2Point(
			[
				9594163765008457007052483351135837548991883620671327820875087487618278420358,
				19919076038656581822242308020471980209714897465930189015640177987594303060341
			],
			[
				15306016222563636424237526902306059796829764475437954911891547698336805531839,
				21481934666819858882111333231811663159263832609803746451895026275397219044837
			]
		);
		vk.IC = new Pairing.G1Point[](24);

		vk.IC[0] = Pairing.G1Point(
			1968551090408633137223850024480814193306571327545815800174609541193849792963,
			2547578541367050400490424732204589523924787910567455208656901385499898650349
		);

		vk.IC[1] = Pairing.G1Point(
			9870781033015821859048345608785924448275256526395494463498892465268594042272,
			7843986601281751930816353933031993959017612081443799030807249696236193082471
		);

		vk.IC[2] = Pairing.G1Point(
			7344093169384241378495332928570145914214744882831556271267208258256037709171,
			9905875090237672003065284213886524228867836338624845493406604810342223808970
		);

		vk.IC[3] = Pairing.G1Point(
			11672546925736945058722603774034996778471612427967586422739539525969836360071,
			8427948268357686936994159125386990170179499477464207892302241814458326379224
		);

		vk.IC[4] = Pairing.G1Point(
			6595207522120912418904682830570208373480828555777861770434035880966019007932,
			2201376714581688031275900005618853472978355893825685818968275971053250910796
		);

		vk.IC[5] = Pairing.G1Point(
			15337755318651648835030293772534561000763561782154096898773319508172900429025,
			1161668505164873599608019072177064549578565307367102629505369549135312490306
		);

		vk.IC[6] = Pairing.G1Point(
			3630194644436613240562658401471522880173787006523445266479652434725735499654,
			3639947340499613495301889510240402469644201959623498052524243841905943734151
		);

		vk.IC[7] = Pairing.G1Point(
			37867044780453718012925696569535306249760980938489122405130339187227580597,
			5983836446829664980850712131551500793331562776955359605031042531983518195640
		);

		vk.IC[8] = Pairing.G1Point(
			18718829455815052115364070074700105755744865287644303650352684922149899124041,
			15394792270302362551205801110670795286275917549931390540814976179986371957750
		);

		vk.IC[9] = Pairing.G1Point(
			5995742172146683195337898820003575349924802478985270134178956467934199626614,
			16033578990242569974374721792369657383829558579957321549705786307492888152536
		);

		vk.IC[10] = Pairing.G1Point(
			6616177429728658958420610643477762544818989849717161399268501492605698335307,
			16658500397569623874875736714328039340705988992194956622154792135307266982976
		);

		vk.IC[11] = Pairing.G1Point(
			11748774962072186172110404650496135790629447508253002156314546290393027409776,
			8059716897835802985765524968567720509081331897492175329000907769308210865840
		);

		vk.IC[12] = Pairing.G1Point(
			15985827869311966443808513155792735483533836602867312412820766036298111179514,
			13959288370115880833101585121285622521031410630558739406456940876474635257933
		);

		vk.IC[13] = Pairing.G1Point(
			9379579979170153402082414107474682247729205103855186218145280164706715599748,
			16002997304108090916112335006384806935411002650415172031246755220159507830730
		);

		vk.IC[14] = Pairing.G1Point(
			20988082800994844215749720528930397437644116959608603198606919663270429085020,
			2810288440941933874204924201633443774315463972928927437801539509492426852736
		);

		vk.IC[15] = Pairing.G1Point(
			2232718141937033629499033510689631179207578491700864491248877302701276695928,
			15414641162343479800666490788979379631220271694464027192344478237426604784227
		);

		vk.IC[16] = Pairing.G1Point(
			18775791435018748442069554313263948207126551450650205812732618377658641281242,
			21496943231760316703369512657111881495737644357438541501361177409471968736350
		);

		vk.IC[17] = Pairing.G1Point(
			9103442104837547516221756146050780632194849245175894043737964469496834856205,
			7322279057996449002125992116172306394509000829927768357475245709951995729611
		);

		vk.IC[18] = Pairing.G1Point(
			11239904001411003184251919693395371443019467767525502315087659842581195238573,
			91662349997568491378763670808448237458731940829349796579913132134641260969
		);

		vk.IC[19] = Pairing.G1Point(
			1656738020037038217281253315134577526300123353246283531114024556867850676821,
			9368360893459474086211924926147112231168133317842851072702555340131182216148
		);

		vk.IC[20] = Pairing.G1Point(
			17109197493336641649162476250899763488345113708797582719617814141271909975401,
			507527357909498704564339084500435068250348729073713075507090562638975736973
		);

		vk.IC[21] = Pairing.G1Point(
			2715763725696116690002830716960505442518191210596746536344819966272228418209,
			12037976113902635960677155179552925363335110667504376518719938936459739385703
		);

		vk.IC[22] = Pairing.G1Point(
			6084144504649412158048367671117153598467411467977657901857623574946071907320,
			8633213747613919286921913753501586643554981398718376088597061147779849724232
		);

		vk.IC[23] = Pairing.G1Point(
			12553868140946631419732258649532933048805431462057922774600839100559528986052,
			2941521808599363909575164945549901734660236697139158344282037366040209638922
		);
	}

	function verify(uint[] memory input, Proof memory proof) internal view returns (uint) {
		uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
		VerifyingKey memory vk = verifyingKey();
		require(input.length + 1 == vk.IC.length, "verifier-bad-input");
		// Compute the linear combination vk_x
		Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
		for (uint i = 0; i < input.length; i++) {
			require(input[i] < snark_scalar_field, "verifier-gte-snark-scalar-field");
			vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[i + 1], input[i]));
		}
		vk_x = Pairing.addition(vk_x, vk.IC[0]);
		if (
			!Pairing.pairingProd4(
				Pairing.negate(proof.A),
				proof.B,
				vk.alfa1,
				vk.beta2,
				vk_x,
				vk.gamma2,
				proof.C,
				vk.delta2
			)
		) return 1;
		return 0;
	}

	/// @return r  bool true if proof is valid
	function verifyProof(
		uint[2] memory a,
		uint[2][2] memory b,
		uint[2] memory c,
		uint[23] memory input
	) public view returns (bool r) {
		Proof memory proof;
		proof.A = Pairing.G1Point(a[0], a[1]);
		proof.B = Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
		proof.C = Pairing.G1Point(c[0], c[1]);
		uint[] memory inputValues = new uint[](input.length);
		for (uint i = 0; i < input.length; i++) {
			inputValues[i] = input[i];
		}
		if (verify(inputValues, proof) == 0) {
			return true;
		} else {
			return false;
		}
	}
}
