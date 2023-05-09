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

contract VerifierMASP2_2 {
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
				12316126929173668269599721160699183962059891685041424852374127636499357159649,
				2867964447074479633043611587912016787451289204005103484377586562985287107675
			],
			[
				10240383228805306002131492282816304305248799387687956803420685919854331640360,
				10649681465168092930918371361140656821795099309407597422623231649288393864951
			]
		);
		vk.IC = new Pairing.G1Point[](26);

		vk.IC[0] = Pairing.G1Point(
			2863377939839786530010562216933871808590481779980242377951175999468967465064,
			21534726420249497503087567762199829974615436278931415898425167246422627138297
		);

		vk.IC[1] = Pairing.G1Point(
			11924202546725070465157973174286016677612433767615367835145443961004296174925,
			876449574168832357950245028059904870148038907424812542531803038785548817692
		);

		vk.IC[2] = Pairing.G1Point(
			20891253194153066966704165041755722070632855424539934778647333790189530127126,
			21574763333374448662157227500821726122078563783314782471518964086771397675564
		);

		vk.IC[3] = Pairing.G1Point(
			19108624197287170540988917467328222444435518583790508569310154606983298673358,
			14467261068671727682015626687396979685912134133776777582830912864898567053731
		);

		vk.IC[4] = Pairing.G1Point(
			17064864624908754525106337369308654401679484368362048133236875228782305023755,
			2923096068306133951751413499698878597272111066884306478370579089303902704669
		);

		vk.IC[5] = Pairing.G1Point(
			4841797359284457712908352106809513716735171043003358699379795111736917980012,
			4606716525759435954702042885856861195367102925947834223027678863710271376805
		);

		vk.IC[6] = Pairing.G1Point(
			810109021649393719962042196532709656079420664215109731460710264429487183774,
			8522337360480037067445318400919826968269343170885849665385952242347229214842
		);

		vk.IC[7] = Pairing.G1Point(
			1875371417991400968539163246244852885857188218430372744761469667974541071794,
			16110231758332935711299410500398636577233549164492143786861712031485159063684
		);

		vk.IC[8] = Pairing.G1Point(
			12517150897177681138922367058838101064036503385324441533249365697521258293039,
			11414978963312961632117453262666382928975605306942716101816206298228211412037
		);

		vk.IC[9] = Pairing.G1Point(
			15835264173493115046825737748741147947931385589659220750957727945709401838401,
			5125832131217425672011933731060345178342948050610929630463231039204474920559
		);

		vk.IC[10] = Pairing.G1Point(
			18005177500992294256114512655401868214589849131195159429949912768022941198454,
			11101052866258473435340455211307201921910191510975093528383987653181640804041
		);

		vk.IC[11] = Pairing.G1Point(
			19948220423144865908674421247310768857194106863497067785997425986530764673728,
			8752952390681284222751375360281799524177315243653734774870849404280548024055
		);

		vk.IC[12] = Pairing.G1Point(
			14309010464465379121974264949979990268900965374228266355066806420152651560739,
			1361344506190037650968941018909848814625791836175373188879381481100891457901
		);

		vk.IC[13] = Pairing.G1Point(
			10527099717585446578178640264178860505965769189464810616316324254938666914610,
			12046997895411995405295225637961903948175455669190700799099762907945154712076
		);

		vk.IC[14] = Pairing.G1Point(
			1262555229988098250405863365996753360845610402957329700743422394536590623246,
			13683525114839326162269391858519360674014083450341436327514293362150912691623
		);

		vk.IC[15] = Pairing.G1Point(
			5688967238103355286631271886188009813651740412852873032861689412192061915249,
			2802282810298179059800706213060759364623949578724413395933021430778322850214
		);

		vk.IC[16] = Pairing.G1Point(
			12521333071897482512248458089983074802355467541912194430832931933665872703699,
			510505751353499420610813854501715371539117350087623507060690722071020695349
		);

		vk.IC[17] = Pairing.G1Point(
			7901633139141569512203287058114616966157113643621018792781056134640322672374,
			1084061308576959204347186762770561006288953765200912296515750135325970344545
		);

		vk.IC[18] = Pairing.G1Point(
			14557043540608147828784005022787935093118344020270707882661447457273419996439,
			13554597415117517753012225751660541794749445727805914026015683345999270864795
		);

		vk.IC[19] = Pairing.G1Point(
			17435150566721373860755397715014701013290408219364325364785322502768093025471,
			16411451382939803064100773093143010415358004919134093924611535169388047577435
		);

		vk.IC[20] = Pairing.G1Point(
			3870204920575541375454216418612527660453006870874319905226897949610075417400,
			180467914773883587863278951954856165353830258015195327074307492640865555204
		);

		vk.IC[21] = Pairing.G1Point(
			7669179887781544224824962241332691935790021305455960050271148731814860126894,
			13818338858884772428016017068359011765929904120182292593463688687722447232115
		);

		vk.IC[22] = Pairing.G1Point(
			9105987119789282968933475298122477737768053816788015648676634080664115077131,
			152740354195341935837732442108866242392786765933321003969158899856194880686
		);

		vk.IC[23] = Pairing.G1Point(
			2615887554214449679608100926851117225364234212001913794116621725938367868587,
			4403494726556654977398144199955376527973725733060135391160527509874812625602
		);

		vk.IC[24] = Pairing.G1Point(
			12704722315389956828124926588018653038584923192241755325099196195950604745254,
			7122341772547181807739031547588673839437199528284256207049090710364586920781
		);

		vk.IC[25] = Pairing.G1Point(
			17554852548771847013253445869592720321751724001747948732693992100303570898476,
			625572603833649177723547514601508835488940405983839772503946771608064362729
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
