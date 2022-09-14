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
            [12870568288040549343878433479294099961688680330230829304085230220151072778992,
             19793505433202073739875192601127199277882197273675545107223891036011220920154],
            [13361943602784354079170237963529630542978248031941652852734691911852768027231,
             20651547954241079151263250612397169564546900738043180632588062687002438973178]
        );
        vk.IC = new Pairing.G1Point[](23);
        
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
            10399603333748257215323889384540815575309404247669577037717091063430145846039,
            19283483549536133960116265935945836261435554162050846259132223053639893762534
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            7951169672222200456849458053262725831388072393561254685664467777424643234380,
            2003894279065603872594299864416777859171592426878413617472220395416070986611
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            12897940092595629223378421744220813548626546264070944537262323462028447855947,
            1456186958716175854565544840623058242328161243607560849860362337509420121093
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            11230894639510265024247025263906579422695746168163269262208769409040299723762,
            11045067786688133773703100860755870412199549771539935958181421802648101906775
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            847964423022994585244392706260021501520750976641236166855760928367864025615,
            13645263572117052741899523587215087840775545574922191769609267749078110119226
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            19616624343526403933509260091649845791344883956415671921103000919942146860238,
            14658937155528556388287870227116379622374076083836676136748116866017675878636
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            20186625691657491319812675423944127019785294029321742695684161062950862094347,
            4535303899440512636398664178347404989594253455099107898454870293363854765900
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            20194312306021879525492766714551717728564068444978571089845749375170815264053,
            3794230270371900083049386956260928037193171976874275137243337860919012825939
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            3484666617595726102828965421733391858258119679205390851984300156777647411632,
            18187758923544762833464945894684870579499111011470967864112510242416423941678
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            9632577478735428294482145089590899862504805494197148967435759596867369033538,
            693605188202389871739452973793260055805498421396491184510492685348821511363
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            1879849267118532477099009975267725407145805249428155050434526102941049539761,
            8601361075074818850158355948057744542938591410105749591029656459412376256178
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            695077288528702298656571907688934921946598809303798729635090420673002529144,
            1664558093892734652489243902623494454735945334580218991056667521129351924641
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            8790701544186404101451831331674329025473140007023403910536674571664387201283,
            11672780590104420974563820724608764648063186957066663845973307230308459091225
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            20878467916886822864340027766175614844199876132438390333918908012298301464813,
            2208028840081842861273285568298658454948316502295257810909158540335980963730
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
            uint[22] memory input
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
