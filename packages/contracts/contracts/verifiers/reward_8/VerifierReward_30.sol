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
pragma solidity ^0.8.0;

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

contract VerifierReward8 {
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
				4228075836410213913805609161382702665550989959679025856727409101130837253031,
				7528887185032791713108242300056977227594602324449725431456391837326146274997
			],
			[
				7997666074048003043507348979931697791860169023611199667971216336654432728939,
				5680307808284984918326305283087587832442171743156428243321075167765306338407
			]
		);
		vk.IC = new Pairing.G1Point[](26);

		vk.IC[0] = Pairing.G1Point(
			884536507533580153284408647593138266656728741772803607390857697749142320852,
			8556828954282678114917815257180503556758283056970769057718780089130625495236
		);

		vk.IC[1] = Pairing.G1Point(
			18595383761376402030289308166097751334739160282068840669263928176971762751496,
			4804121664756069834513467620145982901077304370649922127616123381987326995164
		);

		vk.IC[2] = Pairing.G1Point(
			20747619010132852758953458410421922490228773766252718447633949379644394566985,
			19432452924438969939275881891157496731528537101114933393377622938322061736625
		);

		vk.IC[3] = Pairing.G1Point(
			12672085481318919052123155667765318017871408109490420857826940556774215987671,
			7300353721309790669548792523523592627570080400336922509968607684769423298099
		);

		vk.IC[4] = Pairing.G1Point(
			5438228071579265295154199658622072307479229462167230802968510295630194855460,
			8198650527768601025128894701892575725353689891622199489883562813150803129565
		);

		vk.IC[5] = Pairing.G1Point(
			3202769676238138972558144525264250889171679062560951613508321628088569673719,
			7562659784465228545110583054533233212907825421843426892681778702966006232231
		);

		vk.IC[6] = Pairing.G1Point(
			13735779618784034834903931193921347255368533561372656180105806373794500801647,
			5067170159240419658312107742563414672086276031152523461370275425853610331910
		);

		vk.IC[7] = Pairing.G1Point(
			21307975245177930237546857594834129241297593443936504500862111660267504559906,
			17625033088933619698197511032181983885666111756668792843176418508830583598164
		);

		vk.IC[8] = Pairing.G1Point(
			14827262574994166544149785556428476859674100746712639590276202792361579968123,
			15668355118024076823657949681583105656876822389115000731861644919342533229103
		);

		vk.IC[9] = Pairing.G1Point(
			19573711610357338705802832200787989477277911224625453873480777538446651140078,
			15328861093911135667160747446138628478513708681332977537413407163996371761615
		);

		vk.IC[10] = Pairing.G1Point(
			12158825539418266677086625924125280744072181554283666841189439153893461098073,
			5204192793943393258480581820895409763884272202537926841780974749518260774131
		);

		vk.IC[11] = Pairing.G1Point(
			2609140368513758757026690630810201496396244849265018112630650417445342616592,
			11533005253719292306130087993054053904382665731272240398860101501562491225295
		);

		vk.IC[12] = Pairing.G1Point(
			18098693118230627409331910157175170952118496725361940792835219036702019162691,
			7873121488266167854423713305350382608852554412991878996722532588795807593008
		);

		vk.IC[13] = Pairing.G1Point(
			12899027599509813289572831494706903025281234060842557288378797901118542026356,
			16506551964259515187083404280929438321330084007891507003779287906994982429515
		);

		vk.IC[14] = Pairing.G1Point(
			18843605500115189053239816599723485843836223212649375683556087381232897697026,
			1537292866968603434723036160657713360228870464887536608013240943862248332713
		);

		vk.IC[15] = Pairing.G1Point(
			3871545234415303160739514769823871726585788834771327384790735407334736446638,
			20650678159667863861155840328191336616677024799963642714410978071215790943324
		);

		vk.IC[16] = Pairing.G1Point(
			2714236181723149799827799819504792267517713405351165234137311959440578066344,
			4884793244628971234369345107173897316991925208712552182176828864383080269436
		);

		vk.IC[17] = Pairing.G1Point(
			21264950997443225845780562982181948198839010443943180326531252800344246052771,
			331886551600286019569533203902843535170973084021328440499062038373988742850
		);

		vk.IC[18] = Pairing.G1Point(
			12222988563137376476507190145003977908328924955108693405786273631716844285951,
			9490756707548809566461850276960528163709403989437566077156710513822523907312
		);

		vk.IC[19] = Pairing.G1Point(
			4073526292977406586103534694682053356479512063888407258598545815851095662818,
			6513006678044279745347960893061370301055658812228450335676225623398740328002
		);

		vk.IC[20] = Pairing.G1Point(
			271399492956977528546570894595650643913419144040806201516101543797642413619,
			21606669041069128157701521660028175805673689656052514350371601204201735310869
		);

		vk.IC[21] = Pairing.G1Point(
			3204869195059367614314759487207875297847350626909406950269942440483831298921,
			635944525428496922865519795814825257234108848543980271870372109181276487923
		);

		vk.IC[22] = Pairing.G1Point(
			5700255221143719099226616227023414730150248503049680411393584576153338721454,
			11794537732858883535143604412518145294732262006796383778005414450048756445005
		);

		vk.IC[23] = Pairing.G1Point(
			1551527198404566254990315760248946647102912085912035158688224371754773344445,
			2984244507782452408528613718253070434100325109684104326622614902544523972265
		);

		vk.IC[24] = Pairing.G1Point(
			18676465316930892058734232792609046828498050052414583830391443522593863065473,
			11848179257518323707181820136508771884132547865264542854375113147541386282702
		);

		vk.IC[25] = Pairing.G1Point(
			15513329234198585138297896284617134190543152621110676620284159996854361993596,
			3927439310518773599440346596978345430135619179405604687160919853721319412202
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
