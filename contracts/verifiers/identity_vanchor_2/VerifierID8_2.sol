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
            [4822190318675005593086384188647170104557661887492959490465423624729754140177,
             11682341144868505498095614641159450206487579196161068663496632870342192250685],
            [1108413374329828772537152940018586354976644787846256288691399136904957806253,
             4913684084853406087210773872894938678669566798125063196492352947180693566087]
        );
        vk.IC = new Pairing.G1Point[](24);
        
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
            13116295037908610401342620894402077899545732008351114478757728055172303065248,
            615176701062982705011212300882960252364258360657039609584520458686816381163
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            17876648929303218643187503994854331403415595205084642073829062487058657931692,
            5178052822414517030271733696786826413305262470779251112145905331497937068684
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            10184584475257633969464765802767883962595842955424149124442753755029229323511,
            17080290673383525149993150579917752468330511464208522704838097790394955693324
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            2599005796289586847783034601698311315325400966899323889348901557748131365190,
            4741785599614992106244103332814774915451532626855485359860562682123033942767
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            19200726499077645804066455454914952091248678843588950905374315066135451196015,
            3361041928048874899949786261694089038838303489273624136628957636420884290291
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            6360051911627172514624097905453575897960432489032687738105833258760748109044,
            9118845178189803266669005491466527612293605804138205408453234792835833320674
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            19701966919253436802881469487336121642834347232849019096765920748510147233156,
            13860484838916875690095309346189706737222351371676007392476168232381980479743
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            2125652519394777738681517560946373384864683173539802194398916355619231958737,
            8609948204450021101434710810465841927328177538681263649493962512421655066770
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            9262744332657928970210630551126124782062312050007037018888696235520752319898,
            12057010333939856179193307913961194098899520996242950972249222841379326493573
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            11296424871007118184937889141218353957900350380323055702325300113358501499826,
            1504077905589435570137018213784424634882420507239605569462930867644920108233
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            17498175572976139613758065253288247877107468293390992826169555136851745008684,
            9311428964715885249883161272188965737656887538807257963494633947256642818197
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            13197521377933106828427291863255302735485032977102962392972053993151001999548,
            4579630386601523486154480914894882419991583764067435891205175272807892776488
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            9622441033710609136006808792487190261071890127851236251170499635084575270186,
            447012764822289152119178583104374739777533039637828996908890806221745737644
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            17212473906832343763844837334602109611912316175286979037991639409324230837195,
            9494339539243501917863887981328306372736039942344336612621942510868188280821
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            10008177930816225724688471721180386550867927416533192867835070578109857638467,
            11090561979969296096615723552676394643489595946076039217049768673472010140967
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
