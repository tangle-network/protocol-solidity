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
contract Verifier8_16 {
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
            9185289679636904250807002150405326182935715140645967819512585569825366657425,
            5423282408992190045487819738714767647088532167732288750630316517344936015416
        );

        vk.beta2 = Pairing.G2Point(
            [788726132811946667524805062205550054915844341283649423638289953620984757560,
             4208717623716461431886405608397274906904995421635456735685103928170678248732],
            [16318027517386215224465564951791411024982545215917110050866706109884690337639,
             4950025973880422291904464136746570687948860894796544815483520239285327061209]
        );
        vk.gamma2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = Pairing.G2Point(
            [17121850379561066180779205267444500086678482061457622635069225943166351311859,
             831620675029563252852514435982089262496536164902977120955083655681454907949],
            [2891116891909320444330686886845873102136959581452570280401217686095394079475,
             18753415030332389735278720116036216908920393873812134018961082336723155638725]
        );
        vk.IC = new Pairing.G1Point[](30);
        
        vk.IC[0] = Pairing.G1Point( 
            14180611607439721673584633835593189840346031236661315355317714928214702036461,
            20132408038459061917228834316767885921374664076886209355853756160407064704095
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            9081956740506299034490942516983241842768532591303262662612344737877978643823,
            333504332035836112403335028396526076800051155287073910386557232546579487047
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            4302308902986832498173667580415516489192308087959320228456726790576507611802,
            16503183256400133276579126432644571069707009995183425314506724828845664129611
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            4731566248994002070592100566058986032707331097193507056385397104051151666623,
            1514990232276842637786450586133504672716795698280229796270913272887495135167
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            21082923860761875450053661863694686369038636644458207433424920718659297679428,
            5650089089283418356942848616902817138821677496745166584101779217108002609947
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            10341616944574110103185076226745495158320388455936518175099708618332644357850,
            2486977738973769990958227140882555138008653380086937337808114010086197982113
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            11996912550504218438126923968591500483846903016023247148098320285104823751531,
            10741014904792676064979043887180531783350996567998575901966648934851182386375
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            21178487161936644241528160956551762228768031953875360505774619088767112533607,
            12710299438353938142281769524473205261994519665980646690785018240208842300597
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            1691267022511751127401980128644159407451140743661585970008528675054875590438,
            9952573554673220792461813126460990554842653251237484460007844369418002618013
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            20010394535432042406761178664163544535358606164808646777617125505911623982171,
            14655987699917108401158123820376925613366387146067729896777748245903244135840
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            3877091578016836157200720802496029799906260813818108512513611077407124038649,
            20454886858410588008831569995414516473219303381815211332971545158201992044120
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            7536695376814919661504918862996400537615658594761073279270129711810856717702,
            3370714085817522091639912114532878612466609368032142260554299596761507923505
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            6952974527956456202692284710682256260487765454669633088231497795214472306166,
            7710667740017745825629018039867603365527405439226185052840887620723218894167
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            4810908137649215147830575053344378546396474778391563669301055645189716300610,
            7763262742294666421871586288264887199222479991035598862690015277771133850891
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            8708313862379176342649915378223864441328919591372178456003865479731730932424,
            18679754114956374713347678153884741699608782234087192933442546053745839935879
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            14875731475911379081676497799168908463719119671258957254068701636562365522595,
            7606817693638431071998332221692492400640691126670627827945363428704967863689
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            7287977889665214390851173374335590837831875747078619000913336192003881745931,
            10333999818735987946389788649056326083224031195256483888387264636975322207363
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            9536095404626168603508954999449217357560775153609360730933411951187524015877,
            11233930249250426358433142682747543132919436617611424765947151084676013655316
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            21502846135590050157560939867346573142503521227012818529165870121414724952196,
            14526359338966759028463851771393998942738396261299885622628528390311146573128
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            1677648264238587985002993211833596379847217180896473548697161618077445121159,
            6434979618046617171579074169293240591103542935584950726895402635610322907113
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            16905366670785415098833201362468381991285931167985422305156383815377266417845,
            8926384124823173032052416568932002593948898082955088110305133508848369743489
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            11153086598038914273374024428554012039283081059126551177095188575982251804226,
            10464678856074364838296630612384015067469401760972530549446680461044316598593
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            12559693524834326778047694698047648859383722819385658817668111097577757063475,
            6320344008739896867241090644947555298579041079535949580209413926816344529435
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            8464487350938567897560750438525018953633043638213626487809442816464041381548,
            7335337159509489067012711227664425517762838323690858535907999274268146576103
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            3793366055439135785402446072607488828574934111396010774770819344007186855058,
            14544875528397032933392943445795499931755256828084287147729811164518064427519
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            13042024177567313967504958448566055402975474399298303182804637387894531033149,
            141588859391573408749605137116137100152429042498220381443013596041856111840
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            8343247177911737762441944217411813829324758158795018772259126767201765957541,
            5384060871140325579113396334441385136522400169039364389594368193733926913721
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            20510246972516254429729961124835544053121707019113694432224897150949521200350,
            3302391651084191931153735996093891642120998355779170064998232601159781894371
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            6626188914611900651933858693494829934651792217168550593783519964186787112375,
            6206351901105347428956817348856895433720697293510831509006168678040661633076
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            8128828749056476514481742621168342965050819133016134609785112841736417559006,
            8961836572850193241311260091751936898365285902502176446070447184494445769477
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
            uint[29] memory input
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
