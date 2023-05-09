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
				20136330324795045827351611754402660227757564573768092536140760594077176185582,
				2044837489918332360907713270195590798485411192109487450790471315949590726813
			],
			[
				1587927063285204745053319754408023371733669303735687807441783118850727068995,
				11517060150076571287430630182758288762337750810996737988225203086739802140049
			]
		);
		vk.IC = new Pairing.G1Point[](32);

		vk.IC[0] = Pairing.G1Point(
			19458049051892496708558492566053267355373867231829810926053523315883230498127,
			1977173038782906353053569135652710338655840576514392804021592572501821690429
		);

		vk.IC[1] = Pairing.G1Point(
			16457498276037612204899725848224715113465813661181384559452673572009538503718,
			329630678188709453665205174985989030826042067249793983805671041921558226896
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
			20604807979742593039325032364207189252079394542495128061318768506733944234868,
			15304839602023971285125432535945879170359161612649760306580302005642306149558
		);

		vk.IC[6] = Pairing.G1Point(
			12096796949983832239023375379879944089103536345243131531899154481268274616805,
			13073133771603171235772922548775941783860472359993414017636401906089605397680
		);

		vk.IC[7] = Pairing.G1Point(
			21496965526862749973628109703473630567738613314668496667996162533222360735337,
			9529777901992622236225925345291307683130159639322636300773992366121029381263
		);

		vk.IC[8] = Pairing.G1Point(
			2825156564206201041619094579463885766504103792624621113378351123171829283640,
			16319837754462574240317903818926781581151488785952497138052681202388262430481
		);

		vk.IC[9] = Pairing.G1Point(
			17268233294174348222218403439934533387514178002087144547175791951885200754835,
			17111653290333549323851023032311771744199339986798963973823083295474867292187
		);

		vk.IC[10] = Pairing.G1Point(
			18534501648137974980146467754585240985671520826407194667570330012330494069163,
			6258046709701696351181840793326479957169344578821083549273833048567027398876
		);

		vk.IC[11] = Pairing.G1Point(
			2226076318077124657139307406123254706372103216466848041677281101170873477256,
			3916394939788451465083011615829764197501802176877397810456881686377169732644
		);

		vk.IC[12] = Pairing.G1Point(
			16395517208020264248470527556140328059472513589093638702077188325433611772755,
			2208093851934206405696156176201627371830851028122051335480430705563916197516
		);

		vk.IC[13] = Pairing.G1Point(
			5416477185350781965086868623345581309231418249988532751402771370078778155151,
			15188562128989800023454508514933844683546474884322153175136043563000628146152
		);

		vk.IC[14] = Pairing.G1Point(
			19255149417653982867742316400345710395167755831856065658402260493384297918012,
			13273352823240102076617618862120659530106951788187773616830335946889095007995
		);

		vk.IC[15] = Pairing.G1Point(
			7828784435152238947402487699073167816053975043922431000116272924075204538289,
			3640778637034438713972976884011974956633068707577441043075703677826554929439
		);

		vk.IC[16] = Pairing.G1Point(
			4338737528169869549754455888198403571193705555236615511522348083096115176723,
			5365802887931701679911899226492472309651112178539233921138631971547958847929
		);

		vk.IC[17] = Pairing.G1Point(
			10473832898887523600346912980382315188802802886093662741949309413827747629549,
			16586825790376519061874163927911137406738516856439086091648460483367892081279
		);

		vk.IC[18] = Pairing.G1Point(
			11520158561204278707421358408059473286013613794916826275599878237219336477751,
			12750771386709038031319600291267092894178412408401310587261562676140078731697
		);

		vk.IC[19] = Pairing.G1Point(
			8174738703658723246689468701329415915013471571466514797300699676435031719703,
			20768056797018043662724585190312316101691135868967519597227070880646303229937
		);

		vk.IC[20] = Pairing.G1Point(
			17234896547635224921482535989621612123762838507550792952999154991344336381197,
			12864771853231614398115374127448342117099299050939849271642323128297661332638
		);

		vk.IC[21] = Pairing.G1Point(
			11439439352408267094590037969099763146593015256796545079646327642476529574565,
			12292131972705758975575065246411036113450085881585358475345096263936719368593
		);

		vk.IC[22] = Pairing.G1Point(
			15554334195346222059487426734973826224936584997803126585205917238214594180111,
			15187620569718277904903876374762809712901157734142017406258773278673487684499
		);

		vk.IC[23] = Pairing.G1Point(
			12791983327703702897590071480881675406029497467344817711846338399109947707500,
			8210768445780821760791501803648310107384554718909847010147734206343833905107
		);

		vk.IC[24] = Pairing.G1Point(
			3179513436559197231363023498394449757702329935674378623411085085272443805172,
			5008828483594543222931112725780095952478455034508524984409640542373789275156
		);

		vk.IC[25] = Pairing.G1Point(
			21858053578584783763474338967607152382695361640986845421278882244951769924865,
			5407875332061379723575810911599901496971063043992096322894170903001201548419
		);

		vk.IC[26] = Pairing.G1Point(
			15338372799230758604020464970936991682562299492478738601683152703090329358175,
			5128985981512868114042600595244896563161775402856827021428198740565924767196
		);

		vk.IC[27] = Pairing.G1Point(
			12996347216254793665091133851332644759675508286084935753163531039386758191984,
			755606113516670619743710869722489649096079152858836264849204886480298547966
		);

		vk.IC[28] = Pairing.G1Point(
			6963259988114126149018308162067453068263566069846873860601464455978375817867,
			293076886540476227914353435591184390170423970916877991924747747896562471905
		);

		vk.IC[29] = Pairing.G1Point(
			818500223525661925853478729339692363986136714820700882786646030515989122219,
			10063543424544455797279087022054674386620393807507280448361314869978093334427
		);

		vk.IC[30] = Pairing.G1Point(
			558032908608799629272796028574501431343558138755994155480173904944556622359,
			20522267498127710245624140459815911923645870109664326470576611547554319494405
		);

		vk.IC[31] = Pairing.G1Point(
			16963068835393929118373244962722322601409034261694754811667319745970955435928,
			8186374326726205813571325711585460036161954108428401719233989076919801080296
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
