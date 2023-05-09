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
				6522788364512814618507188591997957159164622581358940093184779698852636000514,
				5224255303097913779815594072962574449440519951305814056841363690515472562301
			],
			[
				9544525729783078403602761084124992069605976858383217938148916262235643202483,
				10668213132095438243086978739186670050214451459770720834997868829752815933273
			]
		);
		vk.IC = new Pairing.G1Point[](24);

		vk.IC[0] = Pairing.G1Point(
			2645258962681070989111829185388134248142519110074875438036811878487517247750,
			5263856382776835873326528296116849737684472390491046965777494200047907031275
		);

		vk.IC[1] = Pairing.G1Point(
			8050152580026670581985107757649077747818339044840428948750998939295782675897,
			11151950083976134757872119451903112678074302176875083106971563885030739823061
		);

		vk.IC[2] = Pairing.G1Point(
			11821110408725141957423619403997924127451687434007131127016377550799986434705,
			8543238444692572644628545264195906062426154212994476580432361609640036423729
		);

		vk.IC[3] = Pairing.G1Point(
			9072840444721979696591897675322619671868042312326738522090968928426091898304,
			20107813252717333439975494227046054920360521942514100493086752556408491898681
		);

		vk.IC[4] = Pairing.G1Point(
			220423261546553462997533047823491555378972643446486572088844249299586655387,
			19029073761489137095426660179799817224473199845479491382621754898448594463570
		);

		vk.IC[5] = Pairing.G1Point(
			20433355650402628495057408580284600782988615873414191548117189718797746505959,
			4741930305320510373957778944375011386370962633920413868090699599268103823294
		);

		vk.IC[6] = Pairing.G1Point(
			12907837869375850090610700508489521579464691270299064777853439942365562386961,
			7287570522291832209636643729664880271779599211313926275387928416718216592916
		);

		vk.IC[7] = Pairing.G1Point(
			7453802827814296877748125909388005165324811614605974456724932312982107161756,
			3341235306396246768319725543260952577731248680593968570195791047487446166688
		);

		vk.IC[8] = Pairing.G1Point(
			4432810774492286510021774753353489755379203274184187706159313412713177743596,
			11324372455922088022046411930755154753994401374586875320230655244343533089239
		);

		vk.IC[9] = Pairing.G1Point(
			11161907314122591102925674619647247533555889767830107542020303369267872373934,
			1563602159265026202017341281884216938592730528823219087305344688576807358731
		);

		vk.IC[10] = Pairing.G1Point(
			9441354364985285732569638827778073200672834014316679410307856483830805435587,
			19424605643045566306867216282631369360034138566513528882996225951806045283833
		);

		vk.IC[11] = Pairing.G1Point(
			4290244997945311300541621146956901995075402479215599537992640279089970039361,
			14061065990145365045785208007567637693766956340738074078885882875967845640384
		);

		vk.IC[12] = Pairing.G1Point(
			11578659880504812816266211566426511813146258375737177952610884081470171518132,
			16445285671396093487058762377886279378289109411721327709083235221343430404343
		);

		vk.IC[13] = Pairing.G1Point(
			18322619719889476036526505356615123112654453158204430296873905476956518397577,
			16298834768486954972105480372919787805978169502454438185880417281152146209469
		);

		vk.IC[14] = Pairing.G1Point(
			12211082158582121736157277715171665916146511775928459084963768804703347683436,
			17527455478717056855321720514783488310602555118659716176043058931896687540151
		);

		vk.IC[15] = Pairing.G1Point(
			16097848058272274065667445980889542399928048406472727688229868329259200190540,
			21195856963268137952757244573110323594517889165471416787016009747274309431740
		);

		vk.IC[16] = Pairing.G1Point(
			113141377048907701052467595002718803754167127459470330375828409561930954845,
			6678407343978600724194501840427918935931071171143694485479020658597160985988
		);

		vk.IC[17] = Pairing.G1Point(
			20321725468476209460753067313450994602935546976275806212546078015360715295,
			21549681501665127478854538486090976006848877739089325930863067407055356543434
		);

		vk.IC[18] = Pairing.G1Point(
			21433312814731595462343138979889991227821479552133503072868419211065596186642,
			21553188281358789566260231416622453925254403577334299862128664521049571155470
		);

		vk.IC[19] = Pairing.G1Point(
			2677744475196013035294497431615853460777811306752915632721929738409465557384,
			10069868523207558937677828721673466428393370752604077575930511428681564387419
		);

		vk.IC[20] = Pairing.G1Point(
			13650672587727086502523052517951956315742738976630728386143815306934566204062,
			7181218831183207859377138789090759492714412551734225408050532618598550762280
		);

		vk.IC[21] = Pairing.G1Point(
			17790022744254930922358153551109237282959096200408607225509076257552814962669,
			17939829391396300469287738951032594189704426466108978349366170794996554862313
		);

		vk.IC[22] = Pairing.G1Point(
			17554475405903417530186342514054937266814109347977423115160963590320533149211,
			11479408365670730568946452218038704504130775284034218236845654923183370984775
		);

		vk.IC[23] = Pairing.G1Point(
			4092974321259705698688756404654796571005104108416061452018771894635671605129,
			12055086300716409461759577560983660843729551881854747630520037014254006512160
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
