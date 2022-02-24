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
            [3133193833868857445508818336723280512870323382295231958732853133926083987934,
             4118503564411722825814960075103567353918065020351819394721497162737753370102],
            [19938770786964055452752712946338839894623926921924351357762603618024444649640,
             2553936430659135381530094558026970579062929491935256837416550837197267152907]
        );
        vk.IC = new Pairing.G1Point[](24);
        
        vk.IC[0] = Pairing.G1Point( 
            525397982619724545595653576644457083150809179920303370449815067032193079047,
            6869917551517654685201774652290207613461993812565548777878726398722013927841
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
            2617579661289250633106179565653790112780105927925548449890763932168003484006,
            14255982298800981444262697655543422556941022228614725111073176003187609766246
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            2460124684270018518860082729727672999209484745109440103127700723273640731222,
            400957991834898331447406655551102646512827589066791626761314795673791816289
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            11272054732506945961721457617580146729387796977558805782036653355034256623437,
            7870042357975883843199107470897297310665904806830880500077152276756748293544
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            2867662493912913442006575766796817193470470752095352336364685683162356234423,
            10398804797376141904024782041396168393867190400529470746883891883942006041231
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            4585751667985703115436161761933450525707389376605954074378335925060669770853,
            16090070951694837204674254927028353795977183752419186182989701405731058247067
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            18213997028447602291656924621913757012037457024941880742694174375946046179216,
            14488372309299378606848561660674724164987100995054846937840495762623786847311
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            18136468497823776936612624331931166765458589276966663817619272073070010284540,
            15192651997599158870407797544338139048740683519324931574779973062979193419420
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            15834588339860450547825005683503264006345710756332359839988084462603674763150,
            2766968174055722778894266173488602285169044969920481653775074363828307744231
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            15801884263536163664458007437999098447005372028109142732966753461935783970917,
            9425672331542410483856521610136679301745233181678033906048967246891857322340
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            14090468727816984703673822695508934054421439491166465411118146254176425067625,
            15275727191513774696757477038667714802407747739304637200671514896230907009103
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            4801126933606523379132767643154895064360040937273494632576743174462283985629,
            21543588102652985036670295977599229894119970505271800908825743372803117714149
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            18816364969532758329537236656046012370610810235894528586827750430444912911368,
            13607895441467078194536112023171431884161740540742255793968519452092349048444
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            10741999505283567037682525109052621917386299275834900134631497628835542523245,
            14416775657166092604422570998540575242222289561655675159401405883297799172738
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            17001309894885293976739792688581628061934380612692915588801408591688519876648,
            2889776279412578983517039361536061535556821242869697044012780929263003305681
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            2913995862219239783673655061090554722558309738091343688177614450287943426809,
            11335171038432094448911512954393773971627712742370706210538126342928448557933
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            4809937773315936021025256983521895627662239553279310991127203478274279132562,
            1605317235728442748479240418363769267664057212836739892659491510509735333553
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            18240410500913706183387832335183952434929006539688862186630605729464970057999,
            19158389279238621504975435367266522210339349532621989113157460583398202344696
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            15368538230555774010108160263403390414008539573939193654898640155957835094607,
            2821100320878055756238290803987126492886446740816214568243485471591385146722
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
