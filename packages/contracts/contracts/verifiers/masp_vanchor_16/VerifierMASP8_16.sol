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
pragma solidity ^0.8.19;

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

contract VerifierMASP8_16 {
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
				10790949692170501432992571555578800115913264668570327419087979778464094934231,
				18402296092508114103359939429238665785771585926503846657326985699641168528552
			],
			[
				15141170033574420351399642670079410215038884580733779820764237717380435844111,
				11540688333590444159971211523396362793389527107214734561922937642695518144402
			]
		);
		vk.IC = new Pairing.G1Point[](31);

		vk.IC[0] = Pairing.G1Point(
			9361139992222371287406208619768818826009709398960890368138398766629978136094,
			4991194408004489410962733969520860131862494655071144401656423191845778877042
		);

		vk.IC[1] = Pairing.G1Point(
			13262729788049016839842606753123547122022851693845681418656259949947545088424,
			10058773363460385040827639009154250663772277651086239970703656810150151491283
		);

		vk.IC[2] = Pairing.G1Point(
			18417450696834510333327679219122199666552974357597889850830080127299776214834,
			21608441946456313111523493751709769358192876621775806636188885244048415762363
		);

		vk.IC[3] = Pairing.G1Point(
			16959293405837559986340367652440755274937660632289208486596563009235177700789,
			19486964197375296352689355283769514011141124885858834402426867843109909250176
		);

		vk.IC[4] = Pairing.G1Point(
			4280240120519930855655793415628018703536489232176049126531983269107689095968,
			4600051297560012702931739992634186365428544958102309279785109253107750428118
		);

		vk.IC[5] = Pairing.G1Point(
			6993143268990143842363634424159718035455631094828599671169116139907241592585,
			18625896264869453662084159630963910831319155423839282737021906315759964319658
		);

		vk.IC[6] = Pairing.G1Point(
			7285710444848177418789400268683059212777952246418156852181014752981161758429,
			13142978805900648873595170326966328139262924728791502597550192254094830275382
		);

		vk.IC[7] = Pairing.G1Point(
			18137028035948676019693296522588795227516772728113899007663054244741149957769,
			5577823921797980464336326172943422889457067983835718242772331300678937547289
		);

		vk.IC[8] = Pairing.G1Point(
			14234940695213366302907353797610765731182304255481043249548995908285396504379,
			19561712223083704081424810946912914316442388556667896986626055489942197178114
		);

		vk.IC[9] = Pairing.G1Point(
			14996171882698137565361335772574641700417992940526155506351060510193486238527,
			395344635693810611732378185280669670483959106184120817801708324982722085781
		);

		vk.IC[10] = Pairing.G1Point(
			17700818520856082499902166727197679260322658260462812833573760994705113192647,
			16305742904448233440934711924685887255366501125851807654723015870178524725255
		);

		vk.IC[11] = Pairing.G1Point(
			13027146255729941627831249148035936911754060637958511164861932188717483380366,
			50692554650911609525725180099997828747714646192192253305035945527706384384
		);

		vk.IC[12] = Pairing.G1Point(
			5412078680136089272243679606302908272439814122570968657128424122734913114094,
			9681584241595933272953255509373000094767451992503964534397058461618151079015
		);

		vk.IC[13] = Pairing.G1Point(
			11199805197649223997253372995796085376070007959520560468325195308626151348243,
			21249920260077227188322330473535404191541517116249866100881870254089049731107
		);

		vk.IC[14] = Pairing.G1Point(
			900459325929594723309270328931993804206072209599706863756618286808495763034,
			8072985795673562068131309426907859324081877832226003333142627780110651325157
		);

		vk.IC[15] = Pairing.G1Point(
			2622156154406344647394708541881551906189252743194453898254051340067036448220,
			15443777536881747505547781726452442428894267364055645623093940523884037306333
		);

		vk.IC[16] = Pairing.G1Point(
			16408062593564465619904943017727240445766207176616645457964076294894955751303,
			4058053640898395551632473134592386384568059232867763384894330728888749285955
		);

		vk.IC[17] = Pairing.G1Point(
			2402880303576131516541439767525628323233365468859200489347472646369595167963,
			1602759785330935416237918155220380681566064945786400382624833381458241475195
		);

		vk.IC[18] = Pairing.G1Point(
			668001678872475100178757622625451384966260114927571717003358737898748676672,
			20136879078760655426662606491660590486355005715854026808615274087047395880217
		);

		vk.IC[19] = Pairing.G1Point(
			10291809134463518232349421466800947813230769588627387895115942415336397126473,
			3468759755822788364198946561271953158652557044684923353813915383676987163241
		);

		vk.IC[20] = Pairing.G1Point(
			3179992380656125231963370633204310949042287099562897512425634465541926563684,
			3380307348527802668451465388168751983904503492094933959836245674985627718888
		);

		vk.IC[21] = Pairing.G1Point(
			11926043218298537445196574560260228385302576469083258802948024568009125908557,
			12840792390870740533973941900354118733535004949678082480476735842003808946322
		);

		vk.IC[22] = Pairing.G1Point(
			7261362614572306727907226590097464258878852996125723059362679931322194576802,
			15070089352109298314737767219265214552535662518363126843496588128373192258015
		);

		vk.IC[23] = Pairing.G1Point(
			8463355924601894742425871931491985706382524507543423075512794373670041907320,
			10842519204868112462792556726545786746569168367446814373911315637311822851525
		);

		vk.IC[24] = Pairing.G1Point(
			2095703513294499130529991829732638194858912546572512773732263754657146408152,
			4688449145941113654544797953120979495573528529399285791713125270365730037187
		);

		vk.IC[25] = Pairing.G1Point(
			137761621135334445144891708400975101407347722655680421407948508648960313012,
			13527636856709418835111807092985493617053487964106669298370112385156802469082
		);

		vk.IC[26] = Pairing.G1Point(
			4771746522936294568688823407999155479907150251953103514086451211882170948144,
			11038859613427488808465541341418310343646240259972930943188731684744372112843
		);

		vk.IC[27] = Pairing.G1Point(
			1380654713941912541834973570965088543924762497808579062001024182234930067686,
			9942628843193441221117252591884105823786320417146509322815342473403545379494
		);

		vk.IC[28] = Pairing.G1Point(
			5221464250954132015162676328104614690085846931241323744681196286950049196055,
			17248074819791890110866456488468512315725910970838180204744223357840054500309
		);

		vk.IC[29] = Pairing.G1Point(
			10305195293566943844412416580978881233855078610414931134230042917561530777274,
			15905331705383550087902090677438972829835292797980309725840764941353581185272
		);

		vk.IC[30] = Pairing.G1Point(
			18337593239091139831246006230184876296331165871670784672837548307868299168677,
			18253007549941235765547948677682585798051130919450210020320100266105103948894
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
		uint[30] memory input
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
