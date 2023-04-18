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

contract VerifierMASP8_2 {
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
				5803700808730150090915999341623665496467541702981889457920056146908899583123,
				9747291099006910037627065063964991109415015442394478976782570939541916220396
			],
			[
				803647879740042740626633907851681644098673176314804159785778723491951661127,
				14229152693010671488557967918357209149526291370426249541302787473404070747208
			]
		);
		vk.IC = new Pairing.G1Point[](32);

		vk.IC[0] = Pairing.G1Point(
			16998146903329930956142312600003218821916962929371924367181354488826043782240,
			20422377577903192696816641192345176547379498090981758566047284892330711084822
		);

		vk.IC[1] = Pairing.G1Point(
			11966607125964593631493758395609569177030524456681325214250532642572542313012,
			20750005439989821724215160831903433741246020963228032340328964800912295528291
		);

		vk.IC[2] = Pairing.G1Point(
			13745355702450399124597318016189725412654209400528160869134171145092411815721,
			2474971702106941289929445117428229621637926044082385038078827041526833785245
		);

		vk.IC[3] = Pairing.G1Point(
			19803334752660304313652575742257589853244254725486690341967417141806482152374,
			8331051950835939948212099798403187467386007126768637607590496069950695883319
		);

		vk.IC[4] = Pairing.G1Point(
			5980609833878508085070599169735662430013743665951783226437245731403293982397,
			13624752352904287146468473114253123887912586505432871239765706656885449602720
		);

		vk.IC[5] = Pairing.G1Point(
			2183407986662996988808542592533611053019314748151448803244389131077672687491,
			868785695055649713872441311442105417478481691209581726980869667338160399390
		);

		vk.IC[6] = Pairing.G1Point(
			12264026253855091630955135968405894461607379984057652021105857521000529880788,
			3906688843682849043481642605221832236871566866395160274872516485444391432199
		);

		vk.IC[7] = Pairing.G1Point(
			10771450260597259995271361038619423548215026472630154951214556662066554409302,
			583494342066447236290608002853738684990331758340380917139911601879203783820
		);

		vk.IC[8] = Pairing.G1Point(
			2825156564206201041619094579463885766504103792624621113378351123171829283640,
			16319837754462574240317903818926781581151488785952497138052681202388262430481
		);

		vk.IC[9] = Pairing.G1Point(
			8695362025770338427623926492156740752108623491772949052010050258601979004090,
			15541684840697987923321447350025960946721517907346061295812645138745976251860
		);

		vk.IC[10] = Pairing.G1Point(
			16686069808103610880612621811470230769773848684222648123220880613523445361639,
			17317418863558673657037503822661504299230745366505077329087917466659529331210
		);

		vk.IC[11] = Pairing.G1Point(
			4311636394963092554260313374122517529981529221177699206891282360879640384087,
			16060889405529990791799062405769073413367847078372188043652679900503810934412
		);

		vk.IC[12] = Pairing.G1Point(
			18021311913835212601467857646409562992210073867858889739333036581781250594754,
			17362939981149356390742800998407017595422783393874284766336721721330856955318
		);

		vk.IC[13] = Pairing.G1Point(
			4782735428009753002348311594354848192182724933703609738498780529031865407932,
			13404765629991641115283770819574347963381531074229472388237438802803627229923
		);

		vk.IC[14] = Pairing.G1Point(
			7996641558643111569360733344840690120655047620117713336903710889815259642460,
			3005335223175195139529889933756332276098534165164289202894224947727519932704
		);

		vk.IC[15] = Pairing.G1Point(
			16345866322378830225312423051617278704412075138240648021817834814049744623810,
			17734306825413953820733063437302118437249452442639310018806500541403455496246
		);

		vk.IC[16] = Pairing.G1Point(
			1207718267837061713363681219767600573835266391249492680443895782055485960297,
			16830762472019404020128736204927125181057383493666199876539042091045528701841
		);

		vk.IC[17] = Pairing.G1Point(
			3927336620228504575284481836575164975622193566439249138416502155484569946432,
			5030144152725879989184139272352649718682396285502899596182205095092214800118
		);

		vk.IC[18] = Pairing.G1Point(
			20106289017825357475749191774599979390646658923500085014319324375765623221879,
			21832353706325911919539253643773471192341933337233258870888204515932531382207
		);

		vk.IC[19] = Pairing.G1Point(
			7029340712671535424134064635009407926943920399818997573450516338233352011888,
			4090871582324140684013612186967023047797028489816721838055897793225745116718
		);

		vk.IC[20] = Pairing.G1Point(
			14249492156652072970707311332494868364986512550980716625868057292726043161204,
			14640851659317358679619728720456713362239940713125879886261147542235504611879
		);

		vk.IC[21] = Pairing.G1Point(
			17555884877500396216931436564540730382099981959580924854506549271235418043279,
			2347143796212743913965005856471879363699744130172471756895171480002470211215
		);

		vk.IC[22] = Pairing.G1Point(
			13869146618867258482556634041715104482756086873084492531808031906271094428256,
			1178747005961599861152742886952129312655292408958906501937477044688611724605
		);

		vk.IC[23] = Pairing.G1Point(
			19643692372822220048297784981158179601551576109689457536377711370169172761335,
			4509033545642037353843223002226094714119898720465881616952550396314717487780
		);

		vk.IC[24] = Pairing.G1Point(
			14794211512653176402048981833370547397583741473719627190049299127307067289212,
			3164455697369121230795996543015620877062661215391942252716933811132735401317
		);

		vk.IC[25] = Pairing.G1Point(
			18873283976375207605620728276416985080031332537751091520877031886632157687895,
			6262420136678417313207407076525450760862524548340724953256575122027158258124
		);

		vk.IC[26] = Pairing.G1Point(
			17134174505947130892650060075544094129408730262546727740574677505676446654840,
			10255555008921940242640434449633157814011911497574840997900775127640758873141
		);

		vk.IC[27] = Pairing.G1Point(
			8836282374129882926897684094519030954658857687932803376553285627146290249327,
			9852973017113813713703665214831493137143602033272584359361859705077407348957
		);

		vk.IC[28] = Pairing.G1Point(
			14504574326494697410719266208336248360989927896258518875022802704694087686956,
			2254485862739972132043900615290284568419551902459812877140931444683664501886
		);

		vk.IC[29] = Pairing.G1Point(
			4150303353455806585295807573946447033388498244692601897001331364866549492639,
			18191502172950642514739744504737746453787974258788152753917257314735976550386
		);

		vk.IC[30] = Pairing.G1Point(
			20031078985182107691624679565896655097125060698986080006145805526150058009857,
			20721254137412888421197903859796398665151150923521623399159666204021735286201
		);

		vk.IC[31] = Pairing.G1Point(
			15757448215353643660615218411551993332447534503737438393970963587407722956130,
			12102708400225976684603665973300102892205296449661313900368045420265685971818
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
		uint[31] memory input
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
