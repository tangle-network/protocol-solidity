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
				9549968373638122009812981838007243451761923173859057765104735416149081935796,
				10211264515783042198803629547478229069996996850309517219362057843129452850353
			],
			[
				16684510503647976524517026483725864595007032530092962325573272288354968520805,
				9400529515965041399524072488775010428299777296786887657944638173041293263928
			]
		);
		vk.IC = new Pairing.G1Point[](32);

		vk.IC[0] = Pairing.G1Point(
			19416608842572872936550068098181742970681217883221953276467082368209378242170,
			10166305784716627335676827395765923581335565436947215612406121676212177034333
		);

		vk.IC[1] = Pairing.G1Point(
			11308877065627065313107591408427061363058626370401269550946069743389824120459,
			13956680281401623277435901626645470009330428135540822698616670856415016577654
		);

		vk.IC[2] = Pairing.G1Point(
			10755079932350075533553011059629428163947899471403215780690847500240821737050,
			3707964248201832577814136218969520215340226567929606161643168187931008984678
		);

		vk.IC[3] = Pairing.G1Point(
			1039785143627399871875734835435759198491542461311158699671711093562515564345,
			8194778769633799296066079431807810151690738772011997321080830474252694458780
		);

		vk.IC[4] = Pairing.G1Point(
			13790815628192706223554099842213242364198615618949440017815858622420645248364,
			883628349799842802972378007901532222326028079379418063957763018000399964943
		);

		vk.IC[5] = Pairing.G1Point(
			3372554708917124902436152589321841130869169454516013555125903015694780347622,
			1061766689259236476045212303610673757178799900195680268894026806271190864776
		);

		vk.IC[6] = Pairing.G1Point(
			982094532286421574869336681993049614294478448533235204931342723499471815302,
			7149585675061286839088748582396939850788669270144861886498686681175303775282
		);

		vk.IC[7] = Pairing.G1Point(
			4889825056271081984070519247023393440086973360821992536864098524597826547438,
			21491771933199200997336760236246801216975256799728938345205088741431854960275
		);

		vk.IC[8] = Pairing.G1Point(
			8755288194075886473407238253008374646852269117459940666605891230486374199587,
			6331574723789761821046605447580494850408471467901583210382072722580935466768
		);

		vk.IC[9] = Pairing.G1Point(
			248236701918930948010655020920469986793920745633715905159158093210686183782,
			8153880740163826391782481783789463063476512758947915172173555504843352951028
		);

		vk.IC[10] = Pairing.G1Point(
			3230341964752347044500513544684305389206318876174985020346112008537889100159,
			3338630106688109315095646676347332486765884758624002233308954358715563791757
		);

		vk.IC[11] = Pairing.G1Point(
			10985390730278549062915670542271651298707936523675013283871759658747151390412,
			15555373121343800349814055105328862119618518138890895134768427518715328792207
		);

		vk.IC[12] = Pairing.G1Point(
			16840129813707317417876015485069368122744119459613217810343121344131596708390,
			17128084953197187697461893166229015354761563287240469549713192533418789287819
		);

		vk.IC[13] = Pairing.G1Point(
			8389375772915217737692883150610144163076843382344205256414915287718978396990,
			15196542771140950451846519562394166518266646573376897362402497851633870699042
		);

		vk.IC[14] = Pairing.G1Point(
			9341990164422974263789552226565114299445011222695030891451809025508977135985,
			15254792148782442819805100925572106394617797355092571183917159506037611055898
		);

		vk.IC[15] = Pairing.G1Point(
			19774456109471240469933524712716520598043827149421236731821541907855229984944,
			20054919713350402679924639077588159735112372489883312717249185347390654233972
		);

		vk.IC[16] = Pairing.G1Point(
			15108878384963131972704410785285714393954564378955336452881657048580289308671,
			21768392546887981587651341476082108949082253069734295061028051968508029275012
		);

		vk.IC[17] = Pairing.G1Point(
			18386104305084380046547965620862867213778786497334345474551765265761112730484,
			149505545334908561524181266519103038515379147920959992073191775727627764265
		);

		vk.IC[18] = Pairing.G1Point(
			3851630999233565573118020702116188748785662475404009392072903420803561874309,
			12776333052122339024283856220394926772986617649893513601673953023816159136770
		);

		vk.IC[19] = Pairing.G1Point(
			1491060575786301527506185219882430217951691683963832905106954873152589692944,
			3152257337841072160317019585956568519345410554216363510363934542530261028056
		);

		vk.IC[20] = Pairing.G1Point(
			16755847287711244389561461174965604062449474625323962611633213233827812358730,
			16613946417821345234819859338247471861355705645972003210848476982485422486849
		);

		vk.IC[21] = Pairing.G1Point(
			21304847830942324816931206151040019608170325313795074195938701780914948110917,
			12555595621758343766523416542796209839903722941028882151850044378907609130545
		);

		vk.IC[22] = Pairing.G1Point(
			12761320287932135959376322976467059837420686343398215489082963794873746923806,
			3949560383705436778260800968827276749870386823937176568586789287728195051448
		);

		vk.IC[23] = Pairing.G1Point(
			2633586504251338093894520662539888253977302530740616164731248081252444306579,
			7838179704080320697013862898495482572648093655763625455735688192094352855040
		);

		vk.IC[24] = Pairing.G1Point(
			17192765398032144063600771393800155907415998358227999604639726190088913941372,
			2757158808526600977073157184831386944423369845077111836095039476199390260240
		);

		vk.IC[25] = Pairing.G1Point(
			13394627035030729676085076105718004869504762112623395387445557323955685945699,
			729458932462291752045067848745187442185435438122292758617038663275488702503
		);

		vk.IC[26] = Pairing.G1Point(
			17949885404334083033613279126344068936464264254975014673876780536482592305615,
			11951264875437020651092455030447898718830759596368472627671152227107685801663
		);

		vk.IC[27] = Pairing.G1Point(
			16861694830326195313691140918148391526973592141027832812258869125215740235307,
			6985674739993020943229596503858921597011632970876990445451706556943334517668
		);

		vk.IC[28] = Pairing.G1Point(
			21134558484475126737836883593187543591207849868231135640357608368317693914212,
			17788586068225210793054255219730098191603949306564083288166483530564776678996
		);

		vk.IC[29] = Pairing.G1Point(
			10732146797636701683708896803830979237759026778950306505003960710896325026517,
			2304808476041946165077424820603895066256958319600054810489519052393077647182
		);

		vk.IC[30] = Pairing.G1Point(
			6584981298827010231924478806861535213800177420647123821361185206899798682800,
			1727981267497259379915487087091951489713479548546396735720359891855196219560
		);

		vk.IC[31] = Pairing.G1Point(
			21007283565635911290312407891434038038438337130168398984048444349420679171374,
			21600769958153824260185008296202738103023205226910271844678413803369307820202
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
