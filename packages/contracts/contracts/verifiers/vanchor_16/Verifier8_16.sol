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

contract Verifier8_16 {
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
				13017550493988466644306535285042476596582308864000718572429926659337487008062,
				14856771105816615091993080706209542200744809750803377545729753492136173010068
			],
			[
				1639757951335352444590703903266257208546445317157378838233778249245005443451,
				8228846489198793726728612873341866744152889515407866702874987683690350320785
			]
		);
		vk.IC = new Pairing.G1Point[](30);

		vk.IC[0] = Pairing.G1Point(
			11534482493478758346886554192618238784883448248883037109296878007318870886114,
			3021578327008362591781717827042852569151198189937907073815431819190117333459
		);

		vk.IC[1] = Pairing.G1Point(
			8437006433191134090933539257090916563966460686730952344054105933289780705986,
			14076630508405657688854819167174110408338608435514504307755468016721152419221
		);

		vk.IC[2] = Pairing.G1Point(
			19481809003329402566511184920311426387342895327645894163133459779757861726452,
			10606712050466163180737273542956159200123134513589970534757669384578864652957
		);

		vk.IC[3] = Pairing.G1Point(
			11283441978498122568323495341370819860975737168789248530039711500814988964800,
			3766443652612214546438091906065529856800857407595318103380049491431189797181
		);

		vk.IC[4] = Pairing.G1Point(
			21112151485599195426045781966421449151369181964964542278406175427850878773365,
			18805183651169444283499450297667267630309541295308575863953965504469085588273
		);

		vk.IC[5] = Pairing.G1Point(
			17980756450348850804014332324918645640723886359771728401792336918234788987116,
			11178296895366011939141046753944738530309280026395100628865360829550758483779
		);

		vk.IC[6] = Pairing.G1Point(
			2674573573303597030781072813022637979312197245689162447173717997112314107936,
			18088887041445460180588786672830028207586969228127644472621239825727690726299
		);

		vk.IC[7] = Pairing.G1Point(
			15096872362619907490956168714510793373532548489941482012772520136074880071630,
			13663124255644696589055702579665927211258943740636471819124814582898252617405
		);

		vk.IC[8] = Pairing.G1Point(
			16852599010242070414183180556317919017761549942479907396045898672480199541390,
			2201265772370876998647824383610628519217078377451444483021323306085768152150
		);

		vk.IC[9] = Pairing.G1Point(
			17983843086967802232657071976026270105140875471302106433304487216483620986278,
			6437742068149576480628019629981247558323706189228959102130473687376868963102
		);

		vk.IC[10] = Pairing.G1Point(
			9814205576634535845524951960002811251579121725422762438308314894435509078558,
			2649853708475777964179826849491606940685201037245793103660657754500643918434
		);

		vk.IC[11] = Pairing.G1Point(
			12503003047352397324660418137403195929701273716104674366647012296390184780806,
			17563975225346708351379891921375128255820226656406158352119680438965606467378
		);

		vk.IC[12] = Pairing.G1Point(
			8095166215758711731690495895079081889375860847278822228614204225415633694621,
			20371203423792737510793555197148435583774549342234457303148593390777266332953
		);

		vk.IC[13] = Pairing.G1Point(
			18750538343391941018457728942005196699059741541188724157116020101439095962548,
			21367160466217949887579169013694874009276618350686490303153755525515467893863
		);

		vk.IC[14] = Pairing.G1Point(
			13189451441287887192358039158409298806828260719731486012239552391970906005488,
			984351270492770849203444597324526654654761000778398371082635710687726435283
		);

		vk.IC[15] = Pairing.G1Point(
			14236643271647365776249327280172453623880710593928809134569691653988707781058,
			18379313406053387558859780176174758437563425800495313528391998533788572166982
		);

		vk.IC[16] = Pairing.G1Point(
			14885882306758798937679394610772138922556123227880385870344808873436814022930,
			3934873393257063133916075434168945234055631293765592292343901673375181552269
		);

		vk.IC[17] = Pairing.G1Point(
			20852410337525408428992795899695004554330381739936516870441901299905205279256,
			20648432346885856575420078255725230748619702397387201087589450468340771874297
		);

		vk.IC[18] = Pairing.G1Point(
			6167699461166003748566567594747289131674547000150454009904996589304626584167,
			14110003077488418487783057098556325603292353141295332863985055993945398206528
		);

		vk.IC[19] = Pairing.G1Point(
			20892317574252659735090624277245258193082807848049224448955777134073345685108,
			17727848959971681921713809931721849771484313017968391732789870806782840679927
		);

		vk.IC[20] = Pairing.G1Point(
			20612376222610731408990545559739965790917945837965228469728226036495441146036,
			20351143376878226978145381965490573601268154635222697512049461276320828895668
		);

		vk.IC[21] = Pairing.G1Point(
			20522947517427072557578167925733739815026195252456061540822404306528133008950,
			6036034786533315595464011703289331465287433898610658104234001410127390275895
		);

		vk.IC[22] = Pairing.G1Point(
			20410796723096686566641699882879596519818754353289647070493357891405051737549,
			13189125262776114153651642489071019957668901126196870035821651431860467422633
		);

		vk.IC[23] = Pairing.G1Point(
			3146788100852253288066278206133464680402002171505031301031229329226719437043,
			10396715094779767544731813785877872331726145317387352477574918383699931707909
		);

		vk.IC[24] = Pairing.G1Point(
			21439687928968958399465185756652639162478589285565752006575911526852009438130,
			7297135059223284256740384214554937800272136142055798242764527036404583557135
		);

		vk.IC[25] = Pairing.G1Point(
			12371325521158807364116536202166634842652368662231086806709494938994904680364,
			13133220971573998953122116499486922534369651074468739893016021893214504285030
		);

		vk.IC[26] = Pairing.G1Point(
			21516003372014895147156904238565871466006669740508136449703899324711326195467,
			16278744532999316901560028522840185484837939454171671064194197332363447266974
		);

		vk.IC[27] = Pairing.G1Point(
			5912019115796213199781760116500241215410486247272843508998060723047993766740,
			12312071263749771417514700530216961108776744423975472983260514323185579798281
		);

		vk.IC[28] = Pairing.G1Point(
			20446140985339560388808125805050522681828992995015649353631750743722843544033,
			12985063191741477329911930314893245225347903321658616477211126417641819425305
		);

		vk.IC[29] = Pairing.G1Point(
			7574545305046950711320318712229623062744829304153153967356279538993555666824,
			8122817517496954688328220645343524414698571600813771393507204249091215144851
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
		uint[29] memory input
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
