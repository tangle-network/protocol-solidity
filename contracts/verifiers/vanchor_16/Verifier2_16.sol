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
            [18023830927864155938303506201656695971589747400372672290645739022795515300736,
             7658023810477579921624349967995725427914294593829419376807834673907467011273],
            [2911470264547995281542281034233409567637547150339688960087490097047331092717,
             12753664879227871992641015471455059418296278732156828810569221947240316159155]
        );
        vk.IC = new Pairing.G1Point[](24);
        
        vk.IC[0] = Pairing.G1Point( 
            19690209741121377704179914470537535438257785746462556547727488124391447015759,
            7227750070665189800867624031683750970398284246125649844858832788527704204948
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            9397334490307584521177658153079096823481352633211852662924013504998066362916,
            8257258416010549018584157148931668924114197694641440429087947249663553225029
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            1253399593273578553842954098292363905239086739070516668154846025711755819532,
            9777683835542185784865867088705428783722403891512798960488197539550507689869
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            127387952965958581885264394362299072549979725182106192102575006419249534150,
            9052903766776172959211661602815965301985127378304298141325134751552443928336
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            12483758807351246443998776405693139931541200039149375881732718024875310241637,
            17441010078990046942297572268824598491833805233962761995533591465466176241832
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            17839435621833935310826105647960718519383727310997044329609523639168339292071,
            15914773197965708542917325574461845666335154788411757708112734111318421435696
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            2551390462337429226901463917386534754963825662327810310900287930667933705240,
            5068796056204517415219817756147626569705740853777388083181575207617827223166
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            20542295441161241624529538079002125772444333088087780208778269902256053397371,
            18740979574079408632471214434631891645330519820502447590487631396169824593469
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            739529557772475506263348754546487196247073918099033604029687358977204696686,
            8728972224059453527901068814361190978203410619241510798884149988710591619311
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            11733661405837152289390837400523722977485776191587927285523786412526465710496,
            19120545858080622010693157478369327604587601678731392637462344451932374791731
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            12282775322155608703245286964724083543090391561048038256452943125947611065897,
            18647681017801758092045282358277614170528219013828955504841352389243205731086
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            1840189947721285936644693187745089773909486301659085354976018596782296882015,
            19084576869262146854135182921240180765381699353529064243636245929081911343557
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            6856037736158354332730019959150450215898447529497096120080945865468372320127,
            11008988691921382694299094574598739452981503839787884781817392389429665924244
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            7287020858174558728019816882197232895721100744323068906870034797467508533130,
            2696422729050901856686668753003637877423986524130259528328369824875929924535
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            9723109474765140854370165602807453679720521430272979985678065463158908004211,
            9828462911214308516079668799001371160718804667486578655566707932516914086308
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            11828320201741486984244033992758540268689574031537632690670577165188204962522,
            5673377941398312972806294316035689060497467648584653493157300177467621285774
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            19552079310508508548497410557607758522598372336319055893321576006726605727189,
            4882659428713770893729736801126341625238082089909643769713015279394531898336
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            12083084335834737874353605617777787346353728675663429390439042935884590815165,
            20960550289108547316916749599386083428779388074401252512309176251411937419993
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            18320837290588473436338891478662119234705320081205475112290822748519214155127,
            1549865145461041525811177179132915138700276482330032758384203865859817504012
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            841856328837910558058756600967692870901894583520947174888473572721228661703,
            3657192926841680023010987723175742349303585596226197697738975345735420212313
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            20846819446348872450542083075778725456532425817772714518425319439966093004113,
            2774795082273675227453846984375319422041822905520608792610403702343171108856
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            18983877299328413409062354904078753337966956111000844254205677012563922917072,
            18448443334797427828969642942320954620961873658864553386087895185424729541179
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            17951879107862105182999493770968304783677048330243963880327459391248906718729,
            1364837230165518107664841274429203106819063046039966501563247149528245457329
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            15608506545643167830627718250055495909413504555100278362189834325458910854933,
            17289004314216358178626313405328255847709294816297970904108752647331918342122
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
