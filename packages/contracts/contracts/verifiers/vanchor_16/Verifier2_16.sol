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

contract Verifier2_16 {
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
				6135275490561704281641768100871882031636787897821494851889237343812159201470,
				4352419702060053761754088042436595107259930199282090477059397569316728807300
			],
			[
				11647931451530612993471737688336035497678746844947094152135992332982707892335,
				7202201863359038351798056260817144902652470955371947690551739148772751871018
			]
		);
		vk.IC = new Pairing.G1Point[](24);

		vk.IC[0] = Pairing.G1Point(
			18481268487153754348465391643372088782494364641004266881805072433434291864922,
			2392837291795392078034427383372840849112984369177256480949924258155696817742
		);

		vk.IC[1] = Pairing.G1Point(
			4511608921533856518188342967539915448743766074890022625995347642188520376207,
			10080409264036392748329888311455704841256069147428558175234319269821311554654
		);

		vk.IC[2] = Pairing.G1Point(
			5785944718791183385885977836608202831101162445427999352115468229643342801611,
			9314309836304297002630796985988892779588482774750530368844482667155867561171
		);

		vk.IC[3] = Pairing.G1Point(
			5915415365864833976113611443265633577016065766993827554429120614390947943369,
			12464069075931422155959082829109638281776996909471173378452414040132419843322
		);

		vk.IC[4] = Pairing.G1Point(
			14954991951119199592182035542860681901841003633921296096576709305436976267021,
			17412715473066159696534241225813184499979118511140203502980693993868736318178
		);

		vk.IC[5] = Pairing.G1Point(
			5017397525820733081352715201202174079011833410121776448616709405337784776391,
			10708900100056480956794717197191545435550865736835028835883627394458034919072
		);

		vk.IC[6] = Pairing.G1Point(
			15693705374092784485749041213237243315958604834854044236442171037946879551330,
			1274740880340669874270619440926125852848652648222820897503265301336085944765
		);

		vk.IC[7] = Pairing.G1Point(
			4830312491272269751969090272318215339946047783788316956140450370194376942633,
			2364483128414802579024168366373334852874621135338347341425587383122837742909
		);

		vk.IC[8] = Pairing.G1Point(
			4341330212309877039801986302994549494585763564844029366769391689804207075017,
			14808039164886177973520236185617769992245789695748079244742017707193665488909
		);

		vk.IC[9] = Pairing.G1Point(
			21246713748324811563646405867356518093990754472337610021146967803466744518869,
			11375685806872900171964658380829011988838099148985164044123125764998857236865
		);

		vk.IC[10] = Pairing.G1Point(
			10425875368786742614663867602950808206417716656723443400779068213401945435086,
			3630246760878384799882646445178910294488088373003971582166542745572558861407
		);

		vk.IC[11] = Pairing.G1Point(
			6553315986850504721332670961099781702020643519008937284606333677655639748563,
			8396767501740261405314033398690082323347192657200213264011983387753424262943
		);

		vk.IC[12] = Pairing.G1Point(
			16258135015273806338335465757513260077643410335645516121846742217091335989505,
			13784441077544058486890156278332645538604218924995194446930550857770274113111
		);

		vk.IC[13] = Pairing.G1Point(
			12293138913242770088631393318804280019350601923514587751409375497539147502329,
			12276034830900042942665746808394110488012771945203000213309389445139586218003
		);

		vk.IC[14] = Pairing.G1Point(
			15329043677908325513528185368282649925359195168671719111344819154933015958952,
			15735517887740763543427948290960876627299936895499363650834566520053067982920
		);

		vk.IC[15] = Pairing.G1Point(
			1525796633278450185011910123942556097062474202987051897861669625276935050243,
			940432000404014341436585384963861838228176917428596973996732831922686476923
		);

		vk.IC[16] = Pairing.G1Point(
			17573369255163820484079029925637719186387775076215343873899275712692939460638,
			10936971462962309626106238709077908951299038355388865230602371387595442584743
		);

		vk.IC[17] = Pairing.G1Point(
			364016731910596411154791776721392932406733729237268436286867984576046090712,
			17520847958504868331538456974998655472558164098118198598433599601872974098957
		);

		vk.IC[18] = Pairing.G1Point(
			19007567193264889029336214115763935305903154885097258007817149362900967308551,
			5206000435186805396271499277406751590260715867320142970292181961602415578321
		);

		vk.IC[19] = Pairing.G1Point(
			18328086335235898970864247477628478672487246009159957723229382521193079749138,
			14903344434047900717081935479870307462601380233233651111278842683363612257162
		);

		vk.IC[20] = Pairing.G1Point(
			18264620957247254677713113103089683059146760268459895432905072524442448228445,
			7756961996063837314260029503332056308149453503239272383129990774399213580743
		);

		vk.IC[21] = Pairing.G1Point(
			146200724107134576983407875694590259944105187131268772144196133043727242788,
			6351011991406573648374881208900648956826909959760831810414877026988247002980
		);

		vk.IC[22] = Pairing.G1Point(
			14479754959739023633445362898987608116102436716792986988720012181815127854528,
			17957677120605693066796639064253427462629411452641259915402949783639432384036
		);

		vk.IC[23] = Pairing.G1Point(
			13100482703952677724510053958576445720906063934033927337535849144335934376578,
			13510281352111804752424102177081887511153227500831886298717494748628104993663
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
