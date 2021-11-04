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
            [19146340410562508683901269261643043744150012901694618140208897414847988990185,
             18931467028147490752145497726690226420327689567924950859460682917440918271638],
            [6020491411635355253492628555939075818639883136644177069158646307612036241443,
             13221748306301902992734801143661315305640980744573320644116666158024587685196]
        );
        vk.IC = new Pairing.G1Point[](24);
        
        vk.IC[0] = Pairing.G1Point( 
            17317300729419575203373680987099402552549746257503306675107025076905290904406,
            10927594001155025446829569334536456330699836230850066498038950490756325687278
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            19278745016846758815154203679515145939375219906065304588813703555150224653132,
            17423145334468519999268947323455766110897884188669078994316783924036870629556
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            15473900364963170390547483631104403854627330111449621315283583553597363144339,
            2742721022131123037300078862105895395325482641581050348674686112258151147517
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            19905191387247706193046052633810869711473732804346750482971937869483047815047,
            13857859220972376135464930828163747503128136465615566112013863943010671674163
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            14482356007904017609920543308795291877046690454020765943500923480952830655779,
            1201741657804643601267703961485790294133680803119027778900636803124370773428
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            5690928129857765978817311886686280338414259039185240041012553334176672575988,
            775805442166901385294203505146071287380357897628623555949671782389840886784
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            18760893252384842718475333450936140435995464683356754406669229072024951115479,
            8427162290653742278888245836770589796177313970306821967556252574563292108438
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            17620098621905431848704085190090875827711261172596797517082636697895583092872,
            8995173953553273624887698262770847088206235692183871950920071795216731980323
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            17660716625941451162822586996195210245013926888588156208363080500069249813677,
            4817869153897642106791607417616990116972137263657833466868838364191041670258
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            15192158290568994745337211058341296027672049549543914304860876145834796319732,
            9192906723940854089960586861754619663224921717463463642462754190652578265180
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            16050642173147634268327564481467013904314514433003250183720323346845231774235,
            21804932074905622260080926273844667045640998750995908223726530942767612302239
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            3224741047035980567964599259940449341833081495968607986056736156053784437635,
            7010809323605271895492603265550764268004795483685352153206012656584712167881
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            5634106352601123777006329622015214824309253433915749706357033668873952513856,
            6232860814079310810731227886432595678982635759411273956294229112577680016929
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            11582746398439875616857900406027878707912402168273254094783626712662258140333,
            15156276021545817971648989416647272864717271955143296479655958287628152306099
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            16291716729229981450947232467005059733532791632921783931458380657753074333647,
            4988635145143679221583504493810751226455162733786186618002279754826037691260
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            4861324123590551399438364530522480343975880915678552218524087567029743190847,
            14516998378927130633492156000797138869167778221293345418026814572475079694548
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            5783238232710335905262082590354169324761135646956546621485627675738207903250,
            17761594105963544331465577691884803211460347076655156801337718481968032376770
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            6974293320977996118526845862312247028120116741665355665922399381613301519223,
            10694641805470334742858961820737519218563682503908632929092137911549658048254
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            13993540868392780370327740066841656797931533820070340323464094377104512541311,
            1483813366974092018587713209038502671382367691547706336361957739403506144100
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            7150709133228152430361633133107790316845727851726307903779090961531115283645,
            7822423610923182636650868983137635481031111609611876663483425350351744659690
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            5419364107896159801632522994980127311457343240428979514073193983927213713435,
            7021362591640723071799064739385049429199010386084508502815448404141648338699
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            16861915523995918965195914765367158736856005362250320342678347820152498090383,
            552455640652813994151184179656880066662674205040233009917606454911045691492
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            13554909366611090762428616509954534811616203718232439716865572000134423155485,
            1476619702774642876013599967942610518682267673085373340891397387776044841473
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            15459198672560965224120614423905385205194188770129886481694424270741036302724,
            13367568064568605276638438444942441107989115058751501274187407864469471234702
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
