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
        return G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
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
        if (p.X == 0 && p.Y == 0)
            return G1Point(0, 0);
        return G1Point(p.X, q - (p.Y % q));
    }
    /// @return r the sum of two points of G1
    function addition(G1Point memory p1, G1Point memory p2) internal view returns (G1Point memory r) {
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
            switch success case 0 { invalid() }
        }
        require(success,"pairing-add-failed");
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
            switch success case 0 { invalid() }
        }
        require (success,"pairing-mul-failed");
    }
    /// @return the result of computing the pairing check
    /// e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
    /// For example pairing([P1(), P1().negate()], [P2(), P2()]) should
    /// return true.
    function pairing(G1Point[] memory p1, G2Point[] memory p2) internal view returns (bool) {
        require(p1.length == p2.length,"pairing-lengths-failed");
        uint elements = p1.length;
        uint inputSize = elements * 6;
        uint[] memory input = new uint[](inputSize);
        for (uint i = 0; i < elements; i++)
        {
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
            success := staticcall(sub(gas(), 2000), 8, add(input, 0x20), mul(inputSize, 0x20), out, 0x20)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require(success,"pairing-opcode-failed");
        return out[0] != 0;
    }
    /// Convenience method for a pairing check for two pairs.
    function pairingProd2(G1Point memory a1, G2Point memory a2, G1Point memory b1, G2Point memory b2) internal view returns (bool) {
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
            G1Point memory a1, G2Point memory a2,
            G1Point memory b1, G2Point memory b2,
            G1Point memory c1, G2Point memory c2
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
            G1Point memory a1, G2Point memory a2,
            G1Point memory b1, G2Point memory b2,
            G1Point memory c1, G2Point memory c2,
            G1Point memory d1, G2Point memory d2
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
contract VerifierID2_16 {
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
            [4252822878758300859123897981450591353533073413197771768651442665752259397132,
             6375614351688725206403948262868962793625744043794305715222011528459656738731],
            [21847035105528745403288232691147584728191162732299865338377159692350059136679,
             10505242626370262277552901082094356697409835680220590971873171140371331206856]
        );
        vk.gamma2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = Pairing.G2Point(
            [526147166239729800240386714370198645497170501747379599188018613948580752132,
             11530762827864887828225083461868141112857061291262328050369713687135951328690],
            [56103654376648060452453437041646945721106551150069205899932035077173949714,
             8986907587413966661647617587968159638105468938229260006626815479020557770559]
        );
        vk.IC = new Pairing.G1Point[](25);
        
        vk.IC[0] = Pairing.G1Point( 
            1862832167956501745853748595854724406302483208556781253006709654551206108199,
            8551073296617541564220622739990630644079732459859369269481647544398171186319
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            19449273730074653754026584714265970627732389245959173614293967105632584584038,
            19124079672506434997245929248446620625001305673039228386822794701739656909
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            9944563376524985697282551723688329677065202159758622990321665947480369032833,
            20900295422482616592807804506452796178520684447072683875004219848027091379977
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            18390547576940788941528190833072092402384355081669145057946146630950544934384,
            19368722048811755866312436954690936968256760801285661760241334973165134359594
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            21298942982093026994892150225512402216781295210796416148040550233159501637011,
            5408351925675415461680139633693141421107210979566957482316448908911140323147
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            21314660266247384172860618147020338525825951942498060905822767877574413434408,
            9761241758293885742996324878660582956547205477993047808891829071403120298685
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            20740397943718545426290044439391894951059246127487736079899809432594742723940,
            5025924820991218236036985424853400104688516775113979792571445055307747548144
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            6220453728761319699374970716529227933762333571677472194096905052341841907617,
            11324226163664822831757296099135407946033611634233501437121486608554862945688
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            1886852429329118137762162737061912353340055073504391875045883312241666190977,
            15031523973488259632505756305239925320161235963000815758180857264413212664380
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            19928487727782215433123081713958657321222169990442884680230933716144231714395,
            16227766529229350605139806856011906443600209086264723644373594650189315045002
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            4528337547514089619881194148496443970892596037374526693224831796815624947909,
            18860033483944295980352363237519412843774304381197265800340482452128263485028
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            10135919507147568310257026290552609546881769265914576438036548632720213601600,
            8990859973359328900825036942060311715980178031512351595235520128610686230078
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            21022806916546956306875069125926695017732983317932068180174363522822733093544,
            955084619119287506665283547140996444822408044629802012407466127210837988902
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            17913005969246643719632457661447124953860334359713800536818429436231759288117,
            14139209059850821090527344247772828064639927624100763686476775899647962620508
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            11557615012506228381755005124172422958926330723274913049703699171149385300468,
            21494915651866257607135943475940485974233976455654265753620413294884395192807
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            16334924021628742535681893053877485149878207711251417439392451693289159002135,
            287065042251373482490341883104356306942833702217467159425863184493864866301
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            16430736177853824489724620506968967995213553098198020971016691341963126782264,
            1551279138392663230991731729350364786465810837706539347801280757831016416499
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            16700274101253614153033409908171463879748727383393505394458736350717145961146,
            4971821203355485712179680632989241451350917677892035243159832327829951467498
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            11265690960459910521732399934959483411436513335719663333806216480252801172499,
            17724038015544427421402162102236688272711121006062923582430188761250511024658
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            14280747709659830896065772088590321377263548342483065600362664668475627084983,
            8287033696856449519107080498947895882926281234085599661249321362153368346140
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            1268981866451926133348761520754780920938199603806853299236787919020808707593,
            18063337999836143903228972077465322294046024035235197040992520008983645528466
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            1572860482982115087031156605348685793716541329754475365831970444186200420580,
            15513151103036179945686461101019963961561314394180388094243067458394925024218
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            13375459299752656698129600942303917003275069838936316194549085600239471258231,
            20703766505718190883289968499719844182446326905399754921246459624033935644316
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            10819232814212046548088183792151764708336338020537226222560397145318023650834,
            550981395589388467577025269733194056920540662414882876214416579656806271038
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            12410964091517130712593783797150954804226088000690698497280378083732085496463,
            6217935312491966519485166491945801559056892845258172194523746963196893798326
        );                                      
        
    }
    function verify(uint[] memory input, Proof memory proof) internal view returns (uint) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        VerifyingKey memory vk = verifyingKey();
        require(input.length + 1 == vk.IC.length,"verifier-bad-input");
        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint i = 0; i < input.length; i++) {
            require(input[i] < snark_scalar_field,"verifier-gte-snark-scalar-field");
            vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[i + 1], input[i]));
        }
        vk_x = Pairing.addition(vk_x, vk.IC[0]);
        if (!Pairing.pairingProd4(
            Pairing.negate(proof.A), proof.B,
            vk.alfa1, vk.beta2,
            vk_x, vk.gamma2,
            proof.C, vk.delta2
        )) return 1;
        return 0;
    }
    /// @return r  bool true if proof is valid
    function verifyProof(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[24] memory input
        ) public view returns (bool r) {
        Proof memory proof;
        proof.A = Pairing.G1Point(a[0], a[1]);
        proof.B = Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
        proof.C = Pairing.G1Point(c[0], c[1]);
        uint[] memory inputValues = new uint[](input.length);
        for(uint i = 0; i < input.length; i++){
            inputValues[i] = input[i];
        }
        if (verify(inputValues, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }
}
