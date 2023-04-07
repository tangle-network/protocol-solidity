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
pragma solidity ^0.8.5;
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
contract VerifierMASP2_2 {
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
            [2137690888456498912277394475902359444230879454540572097427079009694778012407,
             13134772870027243619548929330501497483255278666703409019107718209634506479802],
            [6017263023235337551978986285406912938612091305349346969789194195908959683777,
             18944662137032137600376152082115912700133163680047734765282549933756930872928]
        );
        vk.IC = new Pairing.G1Point[](34);
        
        vk.IC[0] = Pairing.G1Point( 
            12896205996448120927559141391069716338974377217600434951308259683582705263734,
            11306384532540953820346855176141986096933705300898385768797824691803634750442
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            1643606455389865932265193449793839676566000618207589685285495155045770326182,
            17346508689200429366007909171852139496287081385489624681821238745180119352919
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            11057057421460935748116526979709573257007598494917127174932567455347592656425,
            21251275226074414640316132518579864261161042258013352438111528605525038093982
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            21732541229617651171216972844343193940817925261336743495739693423192657508083,
            4300881822878211028727235087217015583515922276174814407048400143373336329822
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            7169983144926617946600960530637006298901797986542118326850817649202721777219,
            5152257129045214310617802491241982799004054164056113113443861187705232290531
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            13748666053109102868699456315953990646636271697359034524754381000519798007427,
            19098695872585470122536480517858258725162252183289769945325018143996177756001
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            21203721943588951196067944702419816014834359212680518512776797652433777961419,
            14871135785284032806836369420618880289557894929581870702591493369203229687909
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            18488289190217595819833304071275224506892748986354630346258777863082237680355,
            2676749525283089083318492306320654352910384393377447301130441658904913141599
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            20403033093078735207141982858802875496491873730776469198154398822639302808083,
            20336816976181865344879757376923461283869463470888231247512466569291014222469
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            10318112358884313957337421047022737725041596918352466292671647871288077488711,
            13700488408268883506416587483112539124863882052888318972004894316375349624392
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            1929824552461636190704557886974050899336932028683465626882637024225125058808,
            15994187273898150261486470682106968279553272375907281553817872535161218189486
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            10102426748046838725239751735512347967825291214183818943018244620064380916675,
            20452637856448847063251797964975833763886695615657269684219986075551651222192
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            12963128682403499365284273939234416862893921083912567876391094585382379592918,
            13393012011676194707253673939869906869776167234116141969673451015343580350085
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            5109140860620434594630083886288570845742334849085804252284587570976618149297,
            1982323182344772597127885901524205432993580534707190543410409900807021418016
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            17688578460382399609923398371159635278620787537588382684122019206547255586281,
            20341669093558567379790134239192354609793592551092964435276918795801774140330
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            5289363577927549474345684921416934501498490948418673461768887362510567078026,
            11294128495371081015527306962504311450935031602358894578162294225081796219773
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            6871828698574035225698391541872648923370615592508763992653044632378644793235,
            6853186263116656249236045056873157417192360917984238071275543319659188176810
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            3771884923053776775826102664474700304341479416972826746963325067640084740231,
            16681355705659315674406751253301716931550045270916812308421624089459421917673
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            18518018048291073321426354778908701315709497369853044527879558111798778825837,
            12508505714925590760137080859876210398856393688763918667823743366023652493952
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            5160567287547753270664324480813294162099836039177778005110605398222549676681,
            12227764667230098803768385521999111677317025656419931431974313027673906984519
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            10061032202543607512857050098785678602317743648369756406939886257201051060728,
            5264313811318594384582116805819110182116637206568005328279582460056513146505
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            16953442204899115120396898037726880244544675965153522720472446459112133444833,
            7943865033782574938212097565790374957180482518588257262174141553997461293404
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            15453348047213078597495848063840858201463900384388251830129544572822155052428,
            12501952469504414938963407612591986841547123283845572906252265535165417928811
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            15571616672640512842413203010882040538587825773068137000094134231669814374626,
            2503276424236297654948688578627386064872317052681712012530314264924476940970
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            20770120115820880678996238831318957937068694966485272859637560298397231774138,
            18825236475842200236380891112108502561550137499349271276384803702578563689177
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            8490848453187590981832203716759913469579237894245361798552399947546448569609,
            301486021756739948385815189900198084463555108738076149831419861759104554192
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            8739408025013679269926962856397545686606760457043538495925641296033248000101,
            6928697648896378463600011641613079961410068154484992841521451829117960935315
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            13229425799193315727347508884519352322562499285206934173204966637615458444350,
            10543410760086762329046505619922820549783816988368479501290911434777079869926
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            5020365470756793636607027073556216255439961151820433825852351164667267697455,
            5410057428072520655891013194681428570893372990125619688168877027187274059669
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            10966523055458777319956976843595999129321770218711284482697139873031090756500,
            13600036481278439052069122264195087849603641314967569359681500190063522212033
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            14085127807529832720534963086405224168328323982087098914473011350824464374748,
            19108056008210387814857247909260261700785239422829935431987145430642054893499
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            12600418358099622258482522980680768811648409409116170368424979603944482201247,
            2435176217238823149389144439512906159203006847236830597005779927033740951309
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            4167832900034290834129147235751886194189764012561133590570887405579881698897,
            4136474935723022079320320885739297049925386332544026793137994915040228100626
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            9169247539470242102415612545069629045926913397209787423217815802850028234357,
            16731568062221486991888213356635933163486854915661401956345130037077388995446
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
            uint[33] memory input
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
