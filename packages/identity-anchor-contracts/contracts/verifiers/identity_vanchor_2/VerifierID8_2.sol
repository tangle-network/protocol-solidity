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

contract VerifierID8_2 {
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
				5470771292357224324162037181600593787310803236698332408392365334773005080585,
				3494342642698632792945493330785761039749005378104858604249520700320120879349
			],
			[
				19636949787553396692208866092658536686505317638394158311560046322207714016321,
				17154689793746496271935789244545520802485941475858327269600346416623923159021
			]
		);
		vk.IC = new Pairing.G1Point[](24);

		vk.IC[0] = Pairing.G1Point(
			18611062343511170357026553953758987681531643503394025314707050482396395666255,
			21871937856609315565490828962524566910389201797830976035654654241259185294189
		);

		vk.IC[1] = Pairing.G1Point(
			2626850471938876016272250995132059732766702802414678794136113436467701497381,
			15856809560815353250215675532518053108284293527737276069251944177094696612831
		);

		vk.IC[2] = Pairing.G1Point(
			17149445972624492180406560554997486059080227363063999877151374883685294369167,
			923370209582343483534382902433360877085518011178862782681518488009892052028
		);

		vk.IC[3] = Pairing.G1Point(
			20417473811553148448619050325254449341381176913153415632705990668648880964082,
			19212842676028502782078905502288513898901775609524694908204599507508359056512
		);

		vk.IC[4] = Pairing.G1Point(
			3113839248998919148150222311966457667798838587744947227414067830080164495439,
			17599350298379402061066711963207622488966698676898236075850530935406080595355
		);

		vk.IC[5] = Pairing.G1Point(
			15161933654458687779531138005738701071948822246351767415002403707117254709593,
			4283456777077685653627504970688766667750285278794900008396392917183318189844
		);

		vk.IC[6] = Pairing.G1Point(
			14783083858372666270392070738487037527332066739312315309127555992780471167892,
			19987096935750677139560540890546967144803812783740042793332962283466560905367
		);

		vk.IC[7] = Pairing.G1Point(
			2896624934114960471561612808888961000430237704000903604598413400777978522138,
			20863685015972891668404373255113900974340301846718583278325205870259261191221
		);

		vk.IC[8] = Pairing.G1Point(
			6508340445764958285310639653039019394593107384867849792347263007890734482117,
			19356821758081560488138321972663477016666642851877428394098667268356486543665
		);

		vk.IC[9] = Pairing.G1Point(
			16388142491063093532693947815829290664145211304802056002760078794768526047841,
			17093442606964487364267161412828723948788786864591060879778342916916281873355
		);

		vk.IC[10] = Pairing.G1Point(
			21063873767815155348022518442384127489291649486720053943734052788865613453122,
			5757053647888665951846263262066463598769080435404670032554805038676954192976
		);

		vk.IC[11] = Pairing.G1Point(
			7835709697997100403722492282043383726078532353700579251453524362622755128258,
			13398026612042421924647048351949123170996095802448143488137869573581757767277
		);

		vk.IC[12] = Pairing.G1Point(
			16905486623626811833650946186914564652495265079775833606574281122133319312510,
			4427027193758025301553694612964889583972267813249871797238570154256349746056
		);

		vk.IC[13] = Pairing.G1Point(
			10000842517562602959069155718156794808544709834332678159917179926701945774390,
			4938704773073298251056144005210432625250079279710139910301587372734289587663
		);

		vk.IC[14] = Pairing.G1Point(
			20633394807876201703297996957750972575066996755381011587934686084288053805476,
			13704564904538428141779528316331135999912524274190405323646245869532676333954
		);

		vk.IC[15] = Pairing.G1Point(
			14443387715676296192674906794544384137311168721188704733523522408724932219752,
			6428088729870240750338580955220436051158180682246281479413611985744717149203
		);

		vk.IC[16] = Pairing.G1Point(
			13956305720059725136522097658313647870684299367665993695129046258000048965217,
			20225563638691166821878074327855277932767593218972275595102121226540550298950
		);

		vk.IC[17] = Pairing.G1Point(
			16587738518047281634627910596882357687319266831719360348032787256147500768889,
			20861431405239551971326025727032583540133917147214344185224021812242565453623
		);

		vk.IC[18] = Pairing.G1Point(
			18340957541386761368230404588626882995488718633543788802532598537693896834249,
			20505757121991843408984353998515449759033993550178326915106374590854632518049
		);

		vk.IC[19] = Pairing.G1Point(
			18823107582955243296749545767012978506913487366567388961249897410933119158266,
			2540295498873080502738278084748378187334294388859366491553697022944581365683
		);

		vk.IC[20] = Pairing.G1Point(
			8713435974062649198166277037854849354941613305499674037468202588658393009983,
			6751826882427118872560815217109209602886713988448117071506516767514586509133
		);

		vk.IC[21] = Pairing.G1Point(
			15555705049575593729216030156045190112934764433714326390183763977750636367151,
			14825433821645698374432221682580079748012262619055046242161314180820722900986
		);

		vk.IC[22] = Pairing.G1Point(
			13955185291957381082762655488723861296722142172046360205871383587363520827916,
			12054242459929492955672760406108328147348907458023215701419619669424077744084
		);

		vk.IC[23] = Pairing.G1Point(
			2662864612618040313825745082358546624115513040317168822917956601329214766228,
			24333352333740327414230288716985133323391062618552697207636706298003243643
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
