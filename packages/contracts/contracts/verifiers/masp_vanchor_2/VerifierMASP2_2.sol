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
				7220783094677717217022903398982939472057346328127669821933378184296161109507,
				9588055245999303353391336138080638477504811396929873139790291815083466608144
			],
			[
				19966417898552345048331076662184133581025405518286772536645158974076293737258,
				12520594520187454974050194156195127458011002492798958588105839265921558336413
			]
		);
		vk.IC = new Pairing.G1Point[](26);

		vk.IC[0] = Pairing.G1Point(
			7710831492302399414951287710526255503933185386913539180853854530002271797181,
			3439067604380772685301018593265583885038303289507199679008840326576994694147
		);

		vk.IC[1] = Pairing.G1Point(
			966820399675818717103273320095150471184896154786964801527574290249470529315,
			14681341534300340219042950447885465862960539595377993805813053997951697881589
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
			10135895090905926908484235721675544059476965683994273297032534218872225724164,
			3625893880143385734583119675954803558387924285504125871784905095891397576023
		);

		vk.IC[6] = Pairing.G1Point(
			7791980916993402542133467613746665884287258480186610648342815243922477059934,
			19440178802378948071705034903435144765795075287077256723460888815704489328502
		);

		vk.IC[7] = Pairing.G1Point(
			13026951424284561366653213983166925695317679354970483412949656764303864849444,
			2743842691447169963419312139595957725065720958578224454542838138766292744175
		);

		vk.IC[8] = Pairing.G1Point(
			12517150897177681138922367058838101064036503385324441533249365697521258293039,
			11414978963312961632117453262666382928975605306942716101816206298228211412037
		);

		vk.IC[9] = Pairing.G1Point(
			2565096596529264162279641071961364262508953506338010774942868530137559028575,
			20816346298648365221472313918334335169269174838466803654517298357080615776799
		);

		vk.IC[10] = Pairing.G1Point(
			11208326338677838827457732977115169334885580575137528977285838352769239276763,
			15740707452306563951260798697384621479330917186036066112285960005527866719735
		);

		vk.IC[11] = Pairing.G1Point(
			19108878890092151163196053214696777131937511891124987742360571265923653410765,
			19250172865975210491152047742720139760119201502138959139542587848250435752436
		);

		vk.IC[12] = Pairing.G1Point(
			20927033354177149527942414395016903488052422371264564672873870771634074378280,
			2613468618458146071401237262476748073877073956135322206827047978378726359793
		);

		vk.IC[13] = Pairing.G1Point(
			12758924330573249218711039090815357973654510518528003183083672672969278338418,
			16996377210209853911055159401654725443389825704116013654972608797905475398805
		);

		vk.IC[14] = Pairing.G1Point(
			21346745553468962946403788114726538793345664046966508016432139919979367888959,
			13247670851558496094047086391494967985855487988607055998357325997090922905546
		);

		vk.IC[15] = Pairing.G1Point(
			320380797955878005550032530783590678494792667653884516983077771067323588859,
			9085007840735763986619782488587079386996818508867086421778020128041751673348
		);

		vk.IC[16] = Pairing.G1Point(
			21764940644497330715081970782834556755585460400962425384872244698545874538538,
			4513917017803494215452389893878196661378073486003434618625360352629813308690
		);

		vk.IC[17] = Pairing.G1Point(
			7466716976570538509556689168090533305501951767558685566053636392125124751047,
			8707705906062983010131740125870999974790507510295598023112281418142596609368
		);

		vk.IC[18] = Pairing.G1Point(
			734529677628498056279679934253088164025076497625117083187994825146690532948,
			10024696707352442359477632992059108114484353537512264957654131322805192651930
		);

		vk.IC[19] = Pairing.G1Point(
			1530083130620439485895417952451434068663570829514862285572815056254876137865,
			2785630227705240031983945251950152512478679605384735772147408841476811549315
		);

		vk.IC[20] = Pairing.G1Point(
			5366242301917037749357140396634638515297403108456709298930098734228462639793,
			10450221160204436524418585207204502863349097262438759912932248079974020242472
		);

		vk.IC[21] = Pairing.G1Point(
			16775507873474070329248700555199946445892915062889632348044122321523406281129,
			8539311103300999937850031787900439163788420934805192201048975675563465056349
		);

		vk.IC[22] = Pairing.G1Point(
			10067336502939215595359047340756822478706226104544024328862974289267095144185,
			6145343771972458512313609119990895244289367049092309558661807879047681791940
		);

		vk.IC[23] = Pairing.G1Point(
			12032455930805273379461769158740004293869983720295659353726730044249442978900,
			5122831976133467306388902986328866032741569683272396725773663952846948332931
		);

		vk.IC[24] = Pairing.G1Point(
			4782130063681646492292334196501727828673069587053458028744468512321326142471,
			2555104421914415966514923694670255774741240109828256929125026157540140606620
		);

		vk.IC[25] = Pairing.G1Point(
			10789207739810770660527180431493320206172877576951053343536249257768897385696,
			8215819511061529094495507197431145566541134448285466496522319145617855109312
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
