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
pragma solidity ^0.8.5;

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
				3190148788094680042848940402549421403407225911503019120792090780357832069338,
				4286634956294844701955551317481998247390064368170546037516702878870960488088
			],
			[
				5555105455726312928315662975390987337759319059076465746849681336207658777788,
				9145675626860561138739057072444415282134163725534278583815003830583706210012
			]
		);
		vk.IC = new Pairing.G1Point[](26);

		vk.IC[0] = Pairing.G1Point(
			11418185878571590472438087637639215209423089269463570108901539578534698671091,
			5119626626838200756277000947709729838406583678543476755347340236802696917069
		);

		vk.IC[1] = Pairing.G1Point(
			18965354658813689846417996455352369893501285368088799306386022354704322088016,
			20302327395448172459915778577435206537181808185554624452553308150736155784617
		);

		vk.IC[2] = Pairing.G1Point(
			5957356072870684470423347661273905238657280901147521241255531570007742870018,
			5659236603153347900639723183423541085457420804367564295290828679996142759762
		);

		vk.IC[3] = Pairing.G1Point(
			3201686158200433321210970345817048929493456187165015198163700343179687117188,
			16478355199290084026428148927116819159714958967330040232541389118933940678627
		);

		vk.IC[4] = Pairing.G1Point(
			3823052329213890886493566073981456261658511127998539267793664852547234030306,
			15487382197440521865572177593912396837543945305552384996092148936000582454236
		);

		vk.IC[5] = Pairing.G1Point(
			13869642507008485581835116102301048367623534390047540119332748539573590562051,
			8119686185322099525978418190479529174293775844580464758339025154246588324596
		);

		vk.IC[6] = Pairing.G1Point(
			15363280483964874481370580998035761077420320996434979353341485167747005160243,
			6499091521173014360086433657195562115560034491404202777687689095765201602693
		);

		vk.IC[7] = Pairing.G1Point(
			859904651251815171627294064115775532715564854134077418345973810868460573040,
			13712018220421912966651252636150093719834028666243723265650415438799881471284
		);

		vk.IC[8] = Pairing.G1Point(
			6449632776991763394694401465619861647666630296758543015051097900290062203528,
			11184280503196148147505165136066711565656026940097173132905020973955305457092
		);

		vk.IC[9] = Pairing.G1Point(
			7600879668600192625704562372421744409894338614174504498641676642979206599425,
			16747760712472637197903370771399847256612864210198133802585275059753555579046
		);

		vk.IC[10] = Pairing.G1Point(
			9214097573394076907020616473011764827674185872212969888567076157243001004566,
			13704562463817933474082550830237872514613330052169747284053077198907279771684
		);

		vk.IC[11] = Pairing.G1Point(
			330948686479526948692803809388753204136912909034405205533356325925330504721,
			2669876184093250592748438994261742119944119322546159052343307691128172497842
		);

		vk.IC[12] = Pairing.G1Point(
			12243584788525421586641622385533096933817352156061586371401628738730331042760,
			3453931053481514062866019507311418086452937252428129472984664242111099470127
		);

		vk.IC[13] = Pairing.G1Point(
			11847569731377380601278196579099962080350037248913927093551041634173854469890,
			19462738064083239888632200646463123910337187502425458004392530603942059421210
		);

		vk.IC[14] = Pairing.G1Point(
			9736488323444952671341397311201475771357838524640591518209041659262466915096,
			1830780466509404515897780390010809810344084472243730082574480282800431557932
		);

		vk.IC[15] = Pairing.G1Point(
			824696950216601965986515756494042060762969316840286561248082408890810859300,
			17241078001655415618849189832970826810963753648275347331843123828414092399144
		);

		vk.IC[16] = Pairing.G1Point(
			5291455850243919677378800068450883950111733103630713099899107185372205615691,
			2921498587466432332500410406508510034359263674081469797243150955591995569636
		);

		vk.IC[17] = Pairing.G1Point(
			1116322377644207128923763369533055912268856148462272958400655430975644219675,
			2588509882012639154903605141556058970620716976693268728463239239964767527407
		);

		vk.IC[18] = Pairing.G1Point(
			11061386331931380096332742617329472433501683865778066095646015843007361090748,
			21194941644002013718875646103086965743247061141386552799497473790949677436456
		);

		vk.IC[19] = Pairing.G1Point(
			13198284049678306794816441963672199059008141038218199922340233423267801638151,
			9800500108046384259693902936627091383588988220037520694858445193814422745181
		);

		vk.IC[20] = Pairing.G1Point(
			14920922197095887497718758386133798253606191999315278900215657988058801417896,
			3633921325464011029014287246039652588388282019474385705331559642664703878975
		);

		vk.IC[21] = Pairing.G1Point(
			21718559280060784513924548715708082573454456905550989965624484664270424140515,
			9642296954139331567092452118646053969258405220104205299300821002440642071302
		);

		vk.IC[22] = Pairing.G1Point(
			20393291573915219489375188446568024822540369019439689907824417752742309789037,
			2000233960302604421580661560542397513140417773533779674013970130511036992424
		);

		vk.IC[23] = Pairing.G1Point(
			11355031657608800924233879197459295779943919093197839393435039595884525184068,
			6743315427193272165511727119062632733475975286570679316615159467565959780348
		);

		vk.IC[24] = Pairing.G1Point(
			15265954015936998959168395904267188578143098933979046972103131910194223253598,
			14803283401903794610671920649195891660821280614772109658845983476565124984460
		);

		vk.IC[25] = Pairing.G1Point(
			9854383712297094644549039062186228902695280136312605283173846758898394952470,
			18734614683698140425028204348054760745262067308185002154270343326393626410703
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
