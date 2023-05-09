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

contract VerifierF8_16 {
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
				9137829261227853319328407668705280049260721197800905204131118463259447709303,
				18240373378425513191163409502127073139253432295977826439244385424247299960016
			],
			[
				17199478087021256540899411513147108337074281737580930998158134566614948811465,
				13577643676595970460655161488590062022050966418829552870313256998304380715448
			]
		);
		vk.IC = new Pairing.G1Point[](30);

		vk.IC[0] = Pairing.G1Point(
			1450011838548851651641301933999774981622444793059717843108702251278335684039,
			5657829732733922043666985930559136613027148013492528612833948225392533512613
		);

		vk.IC[1] = Pairing.G1Point(
			21065372017713601681796343766284246542391766169647702603754541847319098605736,
			20881845036117753709191937581863376367583052128729220902620100015488675770991
		);

		vk.IC[2] = Pairing.G1Point(
			15353340779764599533800846569309726455859374267766197697362258170868605514020,
			120570168604805986885063254121770802311051435738429229579758141583741794010
		);

		vk.IC[3] = Pairing.G1Point(
			2539121985998089600306539847889571116832259694916091396425235921181194086327,
			4151732329447005403440248163622691730937462551554018927909403467864007714091
		);

		vk.IC[4] = Pairing.G1Point(
			15323925103025042721778770621700183002273525446371586472172112442840051359246,
			11478405650682688254563076494552866705529497856834818746090804769158300751930
		);

		vk.IC[5] = Pairing.G1Point(
			191742465120971493929517671872161382475043323843955685125844956300231556401,
			14870151133168236122750573225105358593229760245537846326372902770358931648223
		);

		vk.IC[6] = Pairing.G1Point(
			1825908795536485206778317178131246382343990788260887211449068807495990795050,
			15337875411529039362078733984195282720826476992873753585523168751290606546951
		);

		vk.IC[7] = Pairing.G1Point(
			7802975787858898559468144663678715098711477225441314526871563930432331889518,
			2120224153121266893638511609876872651408243786835127334866565142731058828860
		);

		vk.IC[8] = Pairing.G1Point(
			15629689373059909070204239910405456827002507716255806801643413163095667792356,
			18526493998386006101119472434585622110129199202878101967498665057403244610864
		);

		vk.IC[9] = Pairing.G1Point(
			18148755098745044270539618149361848877486130698053071878255450838701865867935,
			1836414065968808482155134686094650917330494396840062169773633511349471353445
		);

		vk.IC[10] = Pairing.G1Point(
			14911184585260651869099191315932351505714841274601780932889926177352182884497,
			21445106892989259922268871647401804886937278082874022677016999484374847970743
		);

		vk.IC[11] = Pairing.G1Point(
			17260374027013717527447226911192580929112688219404569020553865936607552933279,
			736156925842590115074764307657929209761714547267732658989294406462534537278
		);

		vk.IC[12] = Pairing.G1Point(
			19796793307345958849971405170854264813416566749303889689416423834984221876567,
			12252169404861211186777642441020029087664521907311518339101364287779055367642
		);

		vk.IC[13] = Pairing.G1Point(
			14341104484722142715126571750851329635581223719680420142648603077697119728249,
			11929404244845748916051340792376018056127518064427442160800392188866741910869
		);

		vk.IC[14] = Pairing.G1Point(
			20489119043122758287880020739195863218249493448402876847025116275120396389375,
			20745210335763935517605502866899342008998009159913645028980283144059392892034
		);

		vk.IC[15] = Pairing.G1Point(
			8802242149192902430332521506452254787713878740360235379952985010912365893195,
			1635900202880541399819629027242744057850501825579354756928074878423668987517
		);

		vk.IC[16] = Pairing.G1Point(
			17970032071672624743780327680268291582699931753120837226170818180627171766230,
			15272104793176209279602297296380501123107847481120204256373280438336785759666
		);

		vk.IC[17] = Pairing.G1Point(
			13930529930520789788457662910762025884704699956969157430179976387659742955847,
			9356037898969127805079423182396107130415726279888956319564382614059661704243
		);

		vk.IC[18] = Pairing.G1Point(
			14980020802236569574607259833149341680568941840053215349607011210119907525531,
			15821299511087207332665303095311543371759738172937474795206644685908461201143
		);

		vk.IC[19] = Pairing.G1Point(
			21247192883189872839054338878162666878677535672075396678365247342429558131825,
			10792487213740687023921199466733756063469287658852281107640262499204606037664
		);

		vk.IC[20] = Pairing.G1Point(
			2450461710841260873076963999495650797010470729456418612768388541707740374074,
			127255499907210354037595244552570445459161184510203135194501731914566721800
		);

		vk.IC[21] = Pairing.G1Point(
			17452257715902836437701967480787689150073881966461666661450849745405817677829,
			17688249103083820067808861253204591424647397907795601740473702101485424259501
		);

		vk.IC[22] = Pairing.G1Point(
			2751689873528791108227267791205173168828392970493811293316853969854036392712,
			3138857182585254375737148307738072432928329876820236107601935646889179795471
		);

		vk.IC[23] = Pairing.G1Point(
			14165012795452973229854378190408829725672774202549211435350596749407454675987,
			9768897102858589267111486338883322943580059970501849119978791133037758740803
		);

		vk.IC[24] = Pairing.G1Point(
			20315952858983474148541324757154446100751661189946495203766014111254599731327,
			7478949822525657670881251834766267844049207228745624652607287782532147355614
		);

		vk.IC[25] = Pairing.G1Point(
			16174022796801329166295410534394643378764735194524132518508404681008613806807,
			10577493861429946200966446914456013427077146908154984824621559716596264771118
		);

		vk.IC[26] = Pairing.G1Point(
			19732205216838727872103239361116307648327773644919049576402603184196679270979,
			9841691036630121781058354181243178604043908436540644011817375996050965127201
		);

		vk.IC[27] = Pairing.G1Point(
			14098912923508093789282940018585736618765149955365304636375605963008593697339,
			1901740508573033640805903912046846273061503753297718453468280437350492875259
		);

		vk.IC[28] = Pairing.G1Point(
			5964004496785729999441273341551367226254981026509500624597927001534544955288,
			21833943734824800942630878240613553551574286472335076332389661992963577350749
		);

		vk.IC[29] = Pairing.G1Point(
			8822803044578337543292653922761671312977959133422874067881538544776456960099,
			14687379142923506806590245984698515606953175821396083351443259691019905677231
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
