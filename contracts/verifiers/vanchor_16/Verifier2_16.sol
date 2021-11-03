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
contract Verifier2_16 {
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
            10272469809358981458841146925949286277332832878405148683907553054306507240823,
            4430102740047049768295896783646187499556023753025141076833455021106945518127
        );

        vk.beta2 = Pairing.G2Point(
            [21210232444881244441683359804539600637526043731793144272967405631097365150883,
             15551640728051401802607496549057166788396530903419071830229399307217826688796],
            [8970131327600365432579311869981144184402598874897048547954264197318388149176,
             13576016604205012226028036761630605413635482115296000614100436825385545362371]
        );
        vk.gamma2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = Pairing.G2Point(
            [17261790780347832195843356936644766435230016182608261123177199238371186639523,
             6213935147065089068895767559587451434555248340059832879124828658227482937756],
            [8750918254925557913393228286245472404046850303177793076672544245396786554642,
             20198573734528545538077175840497511009890320161965862178965229160063989716887]
        );
        vk.IC = new Pairing.G1Point[](24);
        
        vk.IC[0] = Pairing.G1Point( 
            15451327718187312101837853376722373220416808745801532673448082910035974248796,
            15173560584011882619322895271635704497330545902806042766651636823688088823894
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            10059676878965393753460443751636299265143483243827310487175443248202701523538,
            10100272027530843935518401288285863473034780768882671413838907269218728386527
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            4129362497638000130803717792744801560192659964214659260946013044003673538965,
            1311468431700981299437554351465388911786793884551787195705048958481360450184
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            18621395295805915768141583268543557993282574596577277763613077256585380615326,
            14338086107462209699209797760367020068445091033755610608746245342572080048029
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            20529888435664427011095846102597216808334945337311276653819623122793918072447,
            20832049484215608822749656692339129101198312363301088998806070164227010850990
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            10092100418739766587048811138038478645094743195870522086936996407441469458632,
            16945130996651280931884317634168801150645273154599325998709897884063530547684
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            14862104103006361430255874790802573171051193246313209286909727936766262827234,
            18952876392867065335688339654487269610212417725749216956269787788674742981595
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            13193272025895481006165103519489631981750823020346214165065917878253735044822,
            20060886959356290097007931695441320026823204107663245706844497874681896992967
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            17809668050599446069012372934755643966251753014528589410625609411841972250202,
            7052328369750667713132684911440569791670049290534967191843666918960357954793
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            14786167794021866601078902726770242106294270408586495762832557181849586412839,
            17192569761798565391289430846945622716742157045547773009325771030034334153970
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            12663416820101590048266039245145696139294011691531295234848160503743468546791,
            3741631746508770467878075430482011182317327719951904177479261037843552082814
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            1248780566846253841740302809190178210526635504709579682373143881278217181317,
            17925348452789910077959933702599056089743845002565091605251349038054152559914
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            19566084192690630763820626962238345647788895258211707616541304796150906719761,
            380940624213700213878192739926907369446796492095560732651224565109158638218
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            14908189594027327418165874795707283388027185952350601993311413406127347199205,
            17586437823923870631607850812314406664240875948458633387374366629671496452231
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            172416340371976773602445565193506354953706125768018379574918174390637428894,
            4156182892410861967387171455001788030722462598153449446431707818120883217451
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            15066791906108103849184267102247725957421127425647316776154490131252626690816,
            9941413460824710388797555128727389846687842729221288806916291809615568644112
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            12934517836080908655274145399571022118196291930527821160594629787951403824026,
            18503464842188030011006992977232079631022658386563940422590009499994814510098
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            20620878110213160862142987091389462097554292350728198154103242391623982395774,
            13660935528217278669370668778297992615539299850704522957429983177743803504014
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            11909228276008242676899145569332769808563584327110631581227407833512691610297,
            9615943446472166163155100267557774986950659240855095745785511729711618456071
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            17385574459655357940974977087466940571652678990471935623689003892220078982341,
            2428328781669259185886487604238241696771600273426152712125762228659837653934
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            13426759349336013446226636463138635874620107158728515224111356436018759743031,
            10304509238467943149855671860573893637365828635398259816388225792316581715656
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            2425360493204345834430419756133545289557654455659034869820033920832565260055,
            6453465658100201311953151946769960842726300388216433615379207148534746382923
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            6101848017278253681407209497931126396871143361854985991282479500904597986747,
            2563652203368757875821805054139468023679615149660532739394947236419833019045
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            21065024492654290600428427573864617110569589732502574876637708750328348159236,
            18623967673557263806244773245508676241668293174251091967326465180161458261141
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
