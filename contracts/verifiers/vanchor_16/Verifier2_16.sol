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
            [10257770405676038382596391865723988724356836922372346482711416116474158350964,
             2906746302933570144403204455459008073105071484923095893666886976326732161030],
            [18621076427280781555800732577496809930374368837353694027922792796946260487460,
             4712174746160163125330022587284636952658331047679040579882089079338817594224]
        );
        vk.IC = new Pairing.G1Point[](24);
        
        vk.IC[0] = Pairing.G1Point( 
            11821265303977466829501503939063707908470705628012776784337967363339393178274,
            14598701714958220961954797908135554497803661672274122800475077670140855735330
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            2884022754881547374069578884767320538207832516222681752847852230638318767449,
            9798338498584197736889327551728404031348766669352425850445672521839485416780
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            10747965818275238470768448609128149939154132405439002954642866175088392102474,
            2896891104491980947789538226809635687718709381817154771880152471549128428101
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            3566485381028566373704751486471137652377876876628434339404411697321651378736,
            7936439320367772466267846195802678258156486711474981880384705096968236369958
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            7357233444665442285944823615638842117202222719099407272520612277565160728909,
            20471375053059949129847347337660315334621195295898436238534711664131300769380
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            9826736819462480325216615287734044408252047684637041058882286813924112741802,
            20616683017171558192355586254306810356811709785722669719292203593970230035719
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            11289277869196191740161940713916548386615101455138722074925322814273696346840,
            17909096603699868756110036049735011116519647404942400337004093255862900350611
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            10387579170510684619225398566446288834350754246800123396761528589495063759210,
            6799330313530584239298912989723936054769702216462074103072443964672538103030
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            16860368240490210479638737246962991720045445728652650321113526516183099576587,
            429582142167079106199676053506089505138292497136812622426130794943170887225
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            18238528579200171626438313940127031010966176972952092242125020158498313344821,
            10187028505685534712407129652893557806939404400073597140144437571142162773564
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            396033528189687688302365611959290306670913472592140950947862687087944942324,
            847521876911719747024458408839724607516916619152686926447316067637831783801
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            16485347930861160491011750290795072272854610097339334994313354743628480072342,
            8489126706726151988304803904370173348273050148540470033780569000616270504389
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            8310360670514541279404530532610880760861670002178133258560521132168466856452,
            3499324252650543644711508782771154310566864287734513135995983617114986387043
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            6892749790865027196108006732357925899840842988063075851172867593415067732846,
            18015961299596711260793326522308885525787361063263422976626708935508691990603
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            3451824601685902236939025408159495762072288076093831910983285392053899326648,
            17947922244465504058741019279620150270195711012589900773245273246342875399077
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            4358368552265237069883156521439530565210988523133595796169032700137740596250,
            7712185055339309017161557029074754038995088753373424779058286703589430416262
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            4933424383123048952591527800809097692474696308916632014234025650207142680171,
            19064053620231233515831273591458766835724928460527218162029813352950231656060
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            3900172917047686068151393031304371925380259091450526146099253230913058228274,
            14168712437904057272922233430169900128072992948638431480916015476895783368870
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            6797219947883077122965172025704528783016624885015794991306979350551242336237,
            8299145612001047353395814676595101929702587537943438354505301796737664203835
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            20971587662946848085200150260306958185217701660563718874429838993900117066995,
            195502320431402794282912756983005334251790518103218464388135582588214384890
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            3269952009133500433647242354114639862166188340334118931690416366137717163700,
            12564318752785452152251382935878211136298040715032308441657631182157522049228
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            10988395703226329679569422990153615029059130651672755681857387053348154751334,
            18967704716041258278729259694510195061315474643027299666089927799464885026876
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            7702902070339747995468584108849850433625175723452224860695554010911008632433,
            1697456569845667703776015837790401508328681988968688275347992995634396034698
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            4571703302367116651840328981125220148619252078332930349668467083545741579722,
            20486650371006298513191227138414979469714384311974487744753558373804395285051
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
