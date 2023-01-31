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
pragma solidity ^0.8.0;

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

contract VerifierReward30_8 {
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
				10755195978517577158674991876862928326923336344098557229796390939625263901640,
				20801696731395058573446492222393749838575741285967154723261944236983795409481
			],
			[
				18369643969725441209416344644389415018687344714152187055228383317702375797986,
				5966411363589402452634407817496013166191674518243442599420936261186183694090
			]
		);
		vk.IC = new Pairing.G1Point[](26);

		vk.IC[0] = Pairing.G1Point(
			13901895822611751674726441196802482128970163688500841750971345749649481760480,
			2182642142766105442275147861689579464627992735029764134834944143157921344410
		);

		vk.IC[1] = Pairing.G1Point(
			5512605391400171160971726757678006079022204965566407508145659343376737254038,
			12737079922477645363560143937454893443508193658115850338038131636090008776066
		);

		vk.IC[2] = Pairing.G1Point(
			2934233031899722299601455260578196663965224290385966450597172939528557026614,
			21419618477061737598091419954328535651247023075864925075215367017460282393431
		);

		vk.IC[3] = Pairing.G1Point(
			17815646866980645945834851914171101023684240291315026374403264923062255808662,
			14143605310326131525929542768689540077790837924647534727955711910511979702236
		);

		vk.IC[4] = Pairing.G1Point(
			14454279187065202144981474961864389025566731805292039949123632524302426453163,
			9581694572123808643221714451203345955517182775009850457798115519922544249139
		);

		vk.IC[5] = Pairing.G1Point(
			16991226445139714699936202070316949552185765094247944588613757146834438814181,
			18437097825798164594347487206440495967287465623356977093156722462494738553708
		);

		vk.IC[6] = Pairing.G1Point(
			815012890022296353062573296878208319581425779408119741419769086643446092982,
			19420745243798983801521073480628437047022695110903941214412402975963908132009
		);

		vk.IC[7] = Pairing.G1Point(
			9291076998248070792673217977960876842603959515966013247377915459502403177856,
			8074362916588110423314941606803147499200484993112685382460701121668038464569
		);

		vk.IC[8] = Pairing.G1Point(
			11662781838172696150686544508905489501870646164289956597094334049440549602607,
			12098298857879582395238519115347241981924753866245067867045509479466864764390
		);

		vk.IC[9] = Pairing.G1Point(
			13450275367614217010649176883736309414924950533363426721298213466107625408091,
			257858868419438629534371693168078145429851757056892877042366809870843900032
		);

		vk.IC[10] = Pairing.G1Point(
			11947215650876380810693489523035304880929994838686019948932997108153741428719,
			2933239323600800125439931743135685459832222241579716732394107610197089408803
		);

		vk.IC[11] = Pairing.G1Point(
			12879434843359756770265839631626951770078769657849505955604867296952507338008,
			15813885176098969377410895057095810306951438242140780813986115295292650993324
		);

		vk.IC[12] = Pairing.G1Point(
			20038673806975039807617962103451849019536672588039460215943820013305527831545,
			8136107543309349184819368661348429105170885499596368295743512656399584961301
		);

		vk.IC[13] = Pairing.G1Point(
			16135551746547345827153562648249165857295693731661424637139273781150903151421,
			8512306628199949964848094115442815563750138004376986471705324552767670720315
		);

		vk.IC[14] = Pairing.G1Point(
			13275692543025003842431390741638569593560116624420187510956853650029468456716,
			12074213712800101245668308812700763622871861971538561881611256017360141224783
		);

		vk.IC[15] = Pairing.G1Point(
			1530797324966994569346479823203361848027195647861980971671869955014786846323,
			5531400542956171709401586327552377130490985765777871265864471965662852462521
		);

		vk.IC[16] = Pairing.G1Point(
			14346221513656324013753827623692876610180806727340323885665299061244908597845,
			5668995219663741481803860679963235248745741198003536461990813692329738675314
		);

		vk.IC[17] = Pairing.G1Point(
			9418039845290585435047163779636818752526766041178788097042194254447656110857,
			13514718510840329740536166525768950454085383826091040078036787801918100091211
		);

		vk.IC[18] = Pairing.G1Point(
			1577236938695522125334225605598871575979498894934963231295054643409998221705,
			18991146592934278705043962533795300902372343427176327954019961514531419888598
		);

		vk.IC[19] = Pairing.G1Point(
			1684679716643311613044368478780523514586888017575669140659992266701041106201,
			17181044479190858513110748483494659727048538481626978101349515211150403302380
		);

		vk.IC[20] = Pairing.G1Point(
			20919238015566894073322904665964683003539711343353643457853011132966129855336,
			13735636139168282773929461547589002078407116228320099127061127688953360490250
		);

		vk.IC[21] = Pairing.G1Point(
			21773467061707339919685008259233054614625390206078310990308379828642507923706,
			3984786638608110161942091111356740687725803614173341613917986834575062874525
		);

		vk.IC[22] = Pairing.G1Point(
			15976302252087235383476545055011743466352315391782077133957615222601598958006,
			19687295107483909842437043024542007026554986081996213392689297237219829908232
		);

		vk.IC[23] = Pairing.G1Point(
			6338321169082768536212174568616927309129524114076254241278544443710390600653,
			14324340352010999744802276402969684423440853966210411488696765725674878390459
		);

		vk.IC[24] = Pairing.G1Point(
			21452261096034427026445747494182453255446119274394107334141298617444269514368,
			11939209773185901066217466509895062668161967789108235091626653301099812943047
		);

		vk.IC[25] = Pairing.G1Point(
			14001621816666714662145968745820575515135058095784158100372383705296612327402,
			18836936341124376765228695737062348194439762074468437569030845862219948129162
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
