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

contract VerifierID2_16 {
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
				14657607130299255293077190941496326198533041986079519324728829898803110190986,
				14398356285663295195409926011591734854158245586998701324369694015987556680392
			],
			[
				2292248176593559989752658172913829845686014578337509448532426730358844381004,
				14932740719064665183832388332291287328602878323290352780317454203426441504614
			]
		);
		vk.IC = new Pairing.G1Point[](26);

		vk.IC[0] = Pairing.G1Point(
			1862832167956501745853748595854724406302483208556781253006709654551206108199,
			8551073296617541564220622739990630644079732459859369269481647544398171186319
		);

		vk.IC[1] = Pairing.G1Point(
			19449273730074653754026584714265970627732389245959173614293967105632584584038,
			19124079672506434997245929248446620625001305673039228386822794701739656909
		);

		vk.IC[2] = Pairing.G1Point(
			9944563376524985697282551723688329677065202159758622990321665947480369032833,
			20900295422482616592807804506452796178520684447072683875004219848027091379977
		);

		vk.IC[3] = Pairing.G1Point(
			781657127175646513838965163506571962557526055170703305785848144037008291851,
			10522792075061559486066003810529679268245107910757960177188849501107232407569
		);

		vk.IC[4] = Pairing.G1Point(
			21589545712952461676474636239923614632905661675105801704258725334178026293923,
			18375572687141249860439797062822536697131987741777196557455751873338227597309
		);

		vk.IC[5] = Pairing.G1Point(
			7682540871237450581632461135898027541895950077979447746829891026287572555649,
			11746724751521186797776874829301827164408622915132472245627856212399792798744
		);

		vk.IC[6] = Pairing.G1Point(
			20783065847434526464137016413797563068886289455346058672349076866630406530685,
			20793389594981279941568451477810041913321815315123486273073690295597821524324
		);

		vk.IC[7] = Pairing.G1Point(
			6049365897720626381297816906049364603478670592827693408964421022518430095255,
			669635970429727333534411063228071898031242203030376411515507948240932464303
		);

		vk.IC[8] = Pairing.G1Point(
			15989486587596313812295860971050269776980446168903368956653001987669415291269,
			20530517255532511400577966384078360871251245234090435785388962674797298928050
		);

		vk.IC[9] = Pairing.G1Point(
			17605328793370954816852278220627201407718003879421726096330657255954047662213,
			13008380666684908234497501721195701883317641227358176011996695490582942701973
		);

		vk.IC[10] = Pairing.G1Point(
			10219502347387765531008902354537398853958211016238758918155419685192385997015,
			5800793735604819825310974076292638852208495526323063390393362201206588950355
		);

		vk.IC[11] = Pairing.G1Point(
			16824155659520789931146946175024763661017162767492745545574222157131302261308,
			15423338396899440471598524542778502725650666891019508366933439188732597950628
		);

		vk.IC[12] = Pairing.G1Point(
			6041501983136521078671441137648324905622903321963314622041544629930008145738,
			17268331052892280206476512840688816414304054110611347555143025524437363958643
		);

		vk.IC[13] = Pairing.G1Point(
			1427337525254444270771499951826436096513174916431002573639590773166233661554,
			6041601222001006296746293580462731718841319585488600155079482796388936843039
		);

		vk.IC[14] = Pairing.G1Point(
			16649466491991152382628837195982958187212471475409318346893434595512056621795,
			20532127497203888386589976699350148235325423018605785221845204915037036942437
		);

		vk.IC[15] = Pairing.G1Point(
			21092074290684879444200361406051347727963670240291812003406025715606138376381,
			9532675857057091956121352325596408253395597060161904436299354437649535587633
		);

		vk.IC[16] = Pairing.G1Point(
			19809075818002973918436922374798343419047502693433651039905622352110336442466,
			9116046131623173051812542396682289958966883397123034908361487346576044630360
		);

		vk.IC[17] = Pairing.G1Point(
			14709053857389534896901800480023461098628440631125293539754952235377690878999,
			9056551674567093392336523943961508361025175584497509225261140696140984721595
		);

		vk.IC[18] = Pairing.G1Point(
			7718557886406584960509537259710586189003194276677061526088723529889162695960,
			10434885639394753945846797015966072117165577141758988572427066164474235209410
		);

		vk.IC[19] = Pairing.G1Point(
			15381196696112479142284265824277471185626180003613962867849179253048230429735,
			7456187409434153703109801469705562705844571488848747273400717715593891118278
		);

		vk.IC[20] = Pairing.G1Point(
			8376144245156967380053177957588769706269475013130780300181781862980927671048,
			6574922661947842251800744493008206688123817023410734105973543756571165732749
		);

		vk.IC[21] = Pairing.G1Point(
			9248845890775451259732290436428003210908898871960180168511696976055808970345,
			10417417874227922893902255313522755506282223649964907508403971336739197781068
		);

		vk.IC[22] = Pairing.G1Point(
			6929438488202303412063903790277704257076066263341349665828939986808024420192,
			7449567621074681790322174517873975202026560780786489070347404688568694653815
		);

		vk.IC[23] = Pairing.G1Point(
			15120334675194086999618528672847583601423118353437993342285777301803288813747,
			3897995782081045238026883170318383589082164540949857607584859232350578054072
		);

		vk.IC[24] = Pairing.G1Point(
			1941782210390795053241077554989644578077553930971253113979524746711137829895,
			12429588978001094361936504846018332080020222597437212838886842759287758925728
		);

		vk.IC[25] = Pairing.G1Point(
			19186543379436433365775183073338485026739838314420384291473373052657653875377,
			5399475157212436927492718820406594055332157686916147692136152004850758131832
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
		uint[25] memory input
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
