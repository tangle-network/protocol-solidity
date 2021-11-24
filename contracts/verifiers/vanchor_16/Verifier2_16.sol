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
            15635276308160559792004133274137521635544708393707107117296778344248550957505,
            3717741945256314195289865075076907359794502490207866014317755229824121091817
        );

        vk.beta2 = Pairing.G2Point(
            [7050980761034239836998401171330113822559450636994971400449179984680945710605,
             7245004549500637626631429097675336758284887245753968402756783758231816600578],
            [1912372262250363594846622538306495689461171293922464070666397682496221820996,
             4448756910343248867349276404521881079098652604464026018719784207380017616504]
        );
        vk.gamma2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = Pairing.G2Point(
            [21382237222597055323220884795256743759930269094827105194713819765928850691913,
             10042212748876860546762281296179167730048701103761983179498223946889432676451],
            [19840416411364203795925094061034901025924513522131492993483278668136767747152,
             13340530659084584670623861492346008363849933434823343054811436079072122082325]
        );
        vk.IC = new Pairing.G1Point[](24);
        
        vk.IC[0] = Pairing.G1Point( 
            4207075822026552480598198744060291683181430099118574705348640272749982840357,
            7497442555037192813746913560413712266840962528454255327191185546189748194737
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            17761555362398595009783293425781500639712081501055096735225040953785303503970,
            1518182833666125946339439152612772189835704063911174749772162069260089813290
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            18269599968428174340242050448449835934895745517933466452437343224148297233538,
            7820226984905186523650754681477008356372418107411903157985584063061233014305
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            1109277994640932457642991570468169786023129544016191300391496870109223230704,
            1999550773893661322673199208578488005420873087316463233005109151494026164882
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            19322951615183110440281899565339593140322439860541378760716839985491190263758,
            14801559116687059513879381982718940820215265587921306619350594693231816539865
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            13430395942035116501392885112722333207578487835276880292254927263057792098571,
            20463946657534236421303413903233987746727301699353003904665951651715267408759
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            14353665803398305283990070356520554727126054483297348440911214006917041247371,
            1240037638834359121896220943289038489809058279315390373816969596391235076472
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            2688706967939619793168290001530865728784358460929733660355254331025291007740,
            6354122036335618923651276849202615632719780765920702529310082878821059008765
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            4595013881012969564946898762084966252871329343765524076315392247246482850299,
            1523727544279994174954112590214373613805256529641179731054354247475810189892
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            3321631498596950096710617890035061910251751706128133674648094331757897381563,
            10808404008699427683379730497399270864469129837275445726684691219021223193190
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            416054865911954246585441891287922675513232784090567288490030565057714677516,
            17822493367146615394400099290589848520427144295213918475891674184587210749697
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            19226096028234850260422921455844849658440415996458939150935205596474581296207,
            16546590965917773874879628011724493546928080940621278643459311944169715144767
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            1266428080384740661719145429131833690748961867995457106505333525506767620911,
            18137223296203319092318087031032055828183823050768733944056258095683542290745
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            3159186887301146232811307019656789485272284774741833879204232868143110077779,
            1621969745161871877944233163793401165905989952084450294937640622170930070074
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            17778801217014211002073731562720970780670822726691011453326670591027696540125,
            12532447002583820616987910286138427825368086590188321326790633669684291685204
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            6457783945704405937903097088815868742102128648169744731519797337274035734598,
            10789502095053342818253938729835712033937062893247470984214630502581945054481
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            13555482524869763497542992331095582433897647338740589084397518839724168293043,
            2642702905669353303493183781909477868664267322462922528692319302872464094859
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            6387523156055935025807677331382521742944354309563680841557095444721140722112,
            17434490827746446186963559845251060806939729393799376657338032438283481328704
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            20749678241716618761458970076446760943548181902595589438185760659893129204946,
            525018980825284746487852474621933261897606106212427833558952079146602937499
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            7421387160402263060989076618935760931631067763361224784585653740104152197952,
            12961210372011694138925125417073938372719162126084219177438009550935246817828
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            14488457036451363457485051107270527105291446088602202931105575792651954878778,
            12303575254716590241363636583660470936189851771933767364566918536292957320564
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            21693033489254072080535681674177931436310301202364304352439471468542554685463,
            1301493712030481534514785800019666865342023083789916624053812937466455759949
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            3516808164149257553963566276181967351490335660318477859331289965022567452985,
            19735163156658135717809834475570899707858826856251807961261178927215627738297
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            14934205564805956302880549721706357356739498610318689770349348825125138478832,
            18553566954688569379612544784620467242561659039182052101570136353502866285637
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
