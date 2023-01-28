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
            [3328051591418757569297829886292799420683297874474547011550025924029786177686,
             17768842770389535005158451974310936429404959639980365070153998546413668613874],
            [17620326607308680982411922330389431260793618080037962888914434616768364141095,
             20158004729640994007844062403292673550045858722142631856783773220504198452415]
        );
        vk.IC = new Pairing.G1Point[](40);
        
        vk.IC[0] = Pairing.G1Point( 
            10735181068923209704480478464030532373858917879057772270831486671968650765681,
            10629489652709619874241109125587243729989708016620605550129445997847795800525
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            20387243797825894928094703119946163151761439828383804324083629149332093194937,
            3409108286866761176512674537018684907706663835007987278355363053108725957975
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            6967540263284247506362882411969146262434693262959828353870449387598583509035,
            9460595953677346776593593827109916226014405556355808421945473087639952865439
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            12661812164310847123117145967445468913560148736043648330212321980478579977548,
            5097961782233091540266409800901223049055776359506720374422655056173346446198
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            7562940904076810089434464771984789160081246355652641870267526872198665077822,
            19786937131403041902855566621762246274418174835361027628825295468651681867947
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            21356672792504051992694959227153387354041467518993674994624354668072755958197,
            1094262980703782538839084166215008081115863139615071686183958241654980731247
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            9525086467106696627277988089092222961375791906186843331715579050176890972854,
            3255659979753399807787873256891673950343875775490080109799098111220189442185
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            1228246984002322734413731729689870062096697779004031569266221856747466333261,
            3544169898643848223252110654645858760141993183965972523590021857643277575484
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            6158920461581380683829395941868121583514031214171219826441976463000077707729,
            2759479188638793904446950819403249165477528443588096132904347200667487084409
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            8644534636878739454274616347507433578210613543451062683007371191900051120495,
            18789967737052888815932334151407965792781326654802029558376844020845101969531
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            9076488985941066176875115639864559399691483243778091213595779685183838375423,
            10660840656222059347389609523533402184679952161579988696842617708364877484603
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            8317470549902559555255051373131795089462846478668874017468962853889425697797,
            6324113335600967379066047120379966647446301706248152138770785311529150147729
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            9244090294954619459536895328646740979068854953296575518553435753941490092239,
            2704103700428203357621027712302528989530446011439188519054867643264552746445
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            10026258138962544189975035330458118571598380857138216811950368064639837136811,
            1013862171027836640568503764887881913846991203850680011562318798894670026417
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            1722557598720766946547737789061968108330224126217883213648179717361644675889,
            15280070309599556579495777604134493604505801597780116393371832328229987368042
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            18782113608689470743813339954524634120687768166558713450890682034588343388266,
            12535230091756521206794973548052944960990277740189996795987222903983945297533
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            99881742530938420746950197683339333376928029375544635504475281437659993006,
            18012423777077056304431035453413617303024839726318999233201296738286333396376
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            20971101634096569794715298334887045681387505530793032419627829346456691687286,
            4962401751972458256327067174783361357434672967091185382147595131318482929980
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            1697482125996596725634110603862924389116675789941395606546663684219076975014,
            8718110419941265428362222704547050101086954422010896890563156072003830787062
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            14047045112478019428428106151833939987795234805992773439634137125513293328475,
            17993221110678516051100400833390514580521023492738558867878394566750625904158
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            2102866018917217270317992854364732924753781350530424374681545279349684332307,
            268689400549161518946473040707917967272202511529456333595230517029577832082
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            9806978016317203721400891088483578366274051573156037766097654687084430938447,
            4506961266082017895048163087031097534224805052835644845130773566050422002414
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            12551005141937671596574255306143475507158533034638422787691083345887767253611,
            17366705620234897057371840713552260398576037820359637240596647589098932521550
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            17466959527659978846175550263290177713876964935017382420914608229227287506799,
            14778482224800018195637538356351437150018059131699820701776066903496482044785
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            11551187080794077743479331473958166246388221220457756545279501243958536907770,
            21166071879420158625888650047844794873694206180757389471649262298882122885394
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            9659992214518280765805483524843005294711869318646685985082726925407998045739,
            19155416936705495670666667205837112292026318733731836549197598735365103733777
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            17382908454031464620256957282113061751807244722348816531038416325405546193822,
            10255082556879461085424505601033026915584245956398275928358890675686347435757
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            16275659732940819008282894850513746567756422901972165102706591271229748802473,
            7923182196938524599960867270154778287702376441756873359097066391335181417851
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            16672428538884433224381874922612093177759734936806278930016398074616639053741,
            11659106432506950989439462681266792338342784167996376323583001987034265507712
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            11455875936520054300121382146559490947953887671421137657000223522098516081447,
            2308001241776871519222257783566090677971488206377545368263309788551509253978
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            21204759713820086523364636155871491349763528756415251055852192204029357192969,
            6967022917701651778212258242674238438491637782649158179952396002500091183888
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            11270730428294683997596058426692976392784789760204426281924823974506555748790,
            20857254319062580920865642691984632330631022007365737128122080903463708550756
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            7850352066413527785694883181955984544525386750466189746759940350368604816089,
            18862775982893495102028285596929545186571373491926201834490056183440389692209
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            21159333039110110097958058309341998710397911155039657435835244648271973414432,
            111522351056613140731876865875556677015194674030510717483352131626501659995
        );                                      
        
        vk.IC[34] = Pairing.G1Point( 
            20141527032082650754477816802110782557098261787206940494498566772944334006242,
            10754762606313572834520640707807073310349730214577223294960241069186832165615
        );                                      
        
        vk.IC[35] = Pairing.G1Point( 
            13154607750299865775916589743315155523736961813183948170014564920290868413363,
            11687622661428681726643063822652823947233161729416145730430574443586906294756
        );                                      
        
        vk.IC[36] = Pairing.G1Point( 
            7763259654879631760797233313273968676467187435209211102792316968158166140197,
            9951898794727847565279028816572649995012557392808201592805118201694748420442
        );                                      
        
        vk.IC[37] = Pairing.G1Point( 
            1258979342652540983869396682751430151396234586377320786960996509803257424865,
            9462202502453410607468831264488970834777626142435491419172664562378650990146
        );                                      
        
        vk.IC[38] = Pairing.G1Point( 
            11949653565304628486845919402199704307177335665914924809560179429456606305350,
            11639104138064358017427565210864814908903987133163530631186456472594623210600
        );                                      
        
        vk.IC[39] = Pairing.G1Point( 
            10157263411157750109246331404371793905623756000551247372863862644686489376680,
            2496529799262984266908813466391255216585058314630106548709601874658220712070
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
            uint[39] memory input
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
