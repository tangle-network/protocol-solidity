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
pragma solidity ^0.6.11;
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
contract Verifier {
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
            [15350246870559263560045325601486994617830773930757462730454433477129304563710,
             14603002652580699797826295657233982155089556876975744657401814604827247638360],
            [14127286170500724123997527323512331830720020172297314793714538850049538106234,
             13775921655260939725645888992524892213648519649477692294955462894849832641566]
        );
        vk.IC = new Pairing.G1Point[](24);
        
        vk.IC[0] = Pairing.G1Point( 
            2881122254885784185382512937152696578825228473511723183334526153050295621677,
            21855592221813160397747077117133504900054492138204344682742648926963864246768
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            18673879795541046817348236367137939891230146191682966239406132798737303550103,
            11917984510851502443022631436979499800973730262964527423249604637283871700616
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            16972483368322685369438224744119871277955195606489223792564988104466738540270,
            19513790492006179381540867341961905368277667973505562004377469496381275329057
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            19916443390743732049442107088751342226796562953405430284650323092013648558619,
            13401834943686431945979327127544865245885720693202609315673938206252550627237
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            7988686100508737692455765966945723297613408553825475450149820802843099334128,
            17055502052167112016737888315844691368828142258547720682032028170213290223719
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            10897215808559827818262917748426980300156499011717699559328861679252816631190,
            6028544288791593734227424209005428064221540977077125065749912142124781291672
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            3058371782395322203114398972489333322313428291066632731230972802944759336939,
            21216672323132789234795196094230340790736103101504921583669361612862923398494
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            10001935662495818027762825331998319855659731989668199682563520062943287630681,
            11136633200231177614715890337046391346649676187888714854302700108171447966994
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            20742619913709974209930445277174053262709793006174721436156450878959831347661,
            10964109333142502757216981295141476438061993414164421245169456928791170545258
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            4601498201820215532097555361004945973526210867358481394443952223212424802239,
            18742178316564768530819757606080575422457911442567549693074420842237844960551
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            4400791331675265007567569527547411796768851737787335058526781255071618171095,
            7519191364557356517335514407663062537832632418028297551903310084817399268146
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            1567280079706749501176608809833160045649545729131043901534020032604819842878,
            18477771383065854328602266231699943494859570010891111483519930371520330043401
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            16347523910489148821607640354642694040561209560994483152070206728034223740271,
            9391688844788345518691131269514181416130428590219404137712530968147070150799
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            7494760834603611962391968083466194340466881943492956051554798783292346723923,
            19163927115333196473754525757296091499672781981348573834618715286779468772133
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            3361088569056816257237339649441838403512779667963841970575267175773104621346,
            20916486777711537348961479125872726358803284250402550458324857119814328535279
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            17216107721867193990399403434039768500491746567244390583579613505335086542165,
            11115927524436710210521304051207179681640551242235891737955819271413235603670
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            4171243659717381770322304412481204764268040047851012208030405664167720702355,
            15718278418410311866471739785029873163871235436080207998326237793423763245833
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            18962533673424809347705681616646536673132358786806072334213677639350369806721,
            3875861506332274414566193544379861463538925245639347755078136879929257773249
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            15548128713228698794990512271840027873367387406028207811972676897648793403467,
            18487194079962101877205610170030607811323597664970614969312236155855832832533
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            2716154021763060498239010425870162021734342240800344341736382985582773139646,
            4225911580745049623813645752064451752802067041836709780331846559097036002465
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            21618930270195008651930384325245457983520267652405355057618383886586345027462,
            12296138358203704177777677866839384206286778850146665025843735980966550711651
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            14706054885737082618295331168257268745737484482880892400802053081978912879445,
            20540506856447108328386665153848023211992679068978637225301349668763493884289
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            9219464845811254901415088602207693872320743219787013339218850051390958978672,
            9837056306939514577658834545764242991475586622460061787991155955239670710716
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            9436592402808564622234726468356887211261166369891496950887003520124700792808,
            4025906092563691078953876388840590564265096294504633096570465670835867921025
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
            uint[23] memory input
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
