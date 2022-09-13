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
            [16070995816978353020563641103163064429717257492110116162619226636120377310805,
             2251639900892293580640088881991908495489269165015864062674660840167699154597],
            [18291270441824593937345292480723634735254192321901914295136201358512760289059,
             5370496991634793900044317550952574348339120422878754373972040317168110887998]
        );
        vk.IC = new Pairing.G1Point[](23);
        
        vk.IC[0] = Pairing.G1Point( 
            17379749101498655528022990468649662460891600329144579203546829934587762115130,
            4459031884636957082812346778724527470038266932108097730830024345833223006082
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            4973396011396919419494590553187333660624077515842003515235541801158441040895,
            5867584654099879167860877110845841156595333142275414726020749787430634759284
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            5726799921610326883313609991488752541476214065102567826692139287392072397303,
            20107672055430211145911270214278218701370658786564318239513331445048602102400
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            282658511390976089047598421215210768466565569105114300881541628402227582663,
            7096529578173786080123688861343792152420920196017837354552902369930309264535
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            16390941700992402448863865331083052900809050709289756696257635787135218101523,
            15152554456872731116465020891255977459688259888203146044574630683283005022440
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            2594149445282849076898557246926828577240936946246165063109320871387355981672,
            98906636671139966649157077590648352229071845643793914869987142408042496659
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            10224023637010107445976320422261471832709021171252283611953109036595739419296,
            14396086424341432973788063044197009006154374840998172536767092927700751466031
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            11065144654580126284629448417257821641985206262737602206468476937398830575995,
            1237332835024889301266264561254158323947035709062680412385457030050157866020
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            21798036214676739387158125255357720716769128732571085692683795278179472381476,
            3222395703900610219229473750689446438880077312564091605569517382589868619934
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            4961853760110830262765803782678436735520942227470434208848160499522626965185,
            8682004430624723396476132857661295534916837581938068579309504862572838423438
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            3809147578955094867569816019219106192094770425152272220906272936720066491036,
            8287162275798518381839021485850106458070924741213836790507492707571306653617
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            5328813998975953747684001316088081856539802758897202013471513886285819616987,
            645290358368603672445486633458286088063792119906298129808908490337101964704
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            20286138206812923306102850661975764322572946412078873129831977663552955198581,
            17386304574908290839909583888247139400334884517452931823182353716284798512142
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            11551347163326979084474853962692448756573356355805288738029805584735010761825,
            3070224858636430352028121984876503947908336650672260645317804130082168355861
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            6366214695860929321758136157469391786159361167518757452905137327136714766338,
            4518082102192411633462593540866746711868430436996796825461055365518982419395
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            1258263461089811014343438417499624535632646890695803332959062387295315491686,
            14777055891934300425240018423716158221862608588059004555723780754113327378136
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            16426017175141778974623182737729145957244683609788534371761341199307970734189,
            16484455821109336770395565736478205518656278916913749761249221333661865431799
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            6152523671409355374643804429548254912755375013646049962021247783273015536132,
            1375849319904136227646114154696126041532685970153686182340346579200117806723
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            18112969441801544515877515306686347015118209318655375583834525741325790845146,
            21426866757873758755182745065760520225389011979473470955059490398725892776801
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            8886252765347592476977014632970706059223513962084691654542401632369501401840,
            21482434650083773316187842355541534557820080259236248017703604903922799082176
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            20420997367351338130946865243147038736582880027141795616615235268635731528182,
            4389176540502465173004123482638308979423931073953120599231146784573099608895
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            3200889992707582841471991132757623396016587681155402861675813347867546239675,
            9594299370060164750670765186441469890391443820585687248117754975365227848869
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            2693050238464708653739999282695882324662848588669638814836113679588844337599,
            6542253602957351468184557971105370985970848854766923842267198526698760750614
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
