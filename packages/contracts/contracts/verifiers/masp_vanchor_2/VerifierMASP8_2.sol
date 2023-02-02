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
contract VerifierMASP8_2 {
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
            [9231624577927872504903480027688360887471602429128190494964083962068400137207,
             19346175183506962976618192302641200424110874626274220429688799134372590296341],
            [4045812693761809558264473311306178621460979050363232543110122748304039164841,
             5256422911557287951189575519747361532480979678536231600344587526882639171495]
        );
        vk.IC = new Pairing.G1Point[](40);
        
        vk.IC[0] = Pairing.G1Point( 
            6657025387596180793010759840169842175155765989454561078622428305155378570626,
            4899191840894647698995504929521169757240708551779352674404838257870703133859
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            16007388560368708397346938826958846488344303007334416328188496139228903100496,
            17653272804295018987918362024521051506676063178396538930937745870937879139584
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            13216497478660182034382761121948854767793126945162050932534501881218917342331,
            10742106605446283212845290504731246112153767582573702724034142108730273215555
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            8130062470939653347216579767986562690129586072708668026896510296573370847115,
            19443240171279867143085716510487961118401261128656104666052060565349751350801
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            658165881441877642766875294356791985886180664676284895718619966850593851291,
            13914071258715027977790454771701702725145307629859742722887704544699411724321
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            1842526236547775412401463494889068173611470389943390268788367260659157628308,
            772984274435808018843610328956849170897642050889459487652528073631897091224
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            328068657748077982930588551302500137108430502919499916120863060959922859034,
            16085869432819095536914852980193468395866787841321818150765117706569915489043
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            9887551359862380832869668764447025289167849658434637534621311417245238244351,
            16795349475368910018373158349181596617662793175758125240849385397517988955558
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            3234740802258858853863980561256216910460319531390590853635048688865765316830,
            9184241857355390350736019766361379410964814584573817628117643010478786038554
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            5488759694971333400439485005902395649671850548194196986665184720233934760275,
            6687581443326951857573372730896069080892242609012120625100011343031955052817
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            9608038422126117789844450244818123774793336092922203226659252265007279141322,
            11661314913837182377656779740412555226992637057699770530111516216375166813819
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            11111129227966742809378996882162188988251496402058693613219429109724428601135,
            17477416210523370112284686951984062176436826411894760124463204250040621268498
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            16128687573583371257701020645685922521127176055265072025286187592408964443185,
            9223144856339586203015214919638252079699537945253080947109070671024902324096
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            4436917848714923824549856253389539639443527476912797895615964875228547696385,
            11159749981451584272689432196277465830362395280425280027080524366127633784057
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            18495113343000591896681634387992265022206579853515194803593188163921620489625,
            13896129470664634326629344946565545187547547866528893847674527492551161362199
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            5591654146380708245915048560113032588560476285582451503716166134072507067965,
            14293400421925915556351009988287147861855129867235737979090968672971875562530
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            9955015923402210125186978741587871953703903434418542083126305566100832850349,
            14610731938770513759048555346067300730506280423032466330116693437244932318395
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            16590862426078622147008484851280625557455868478286848937899393592676758165431,
            2310304786107569276150501767544782305180231166438882212806418135000781324271
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            16667814464920700732569469570516091223293268289014143393295114485367307242782,
            3693356837957755250448086670671168617033818456756845587336219613705143419287
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            3253312456276259999151957642279486581713574728721140315750793803556412202668,
            9917829143501653015431238117271181769742777794725554450603244672303199227915
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            17724887283345163501459621949948783194400385754797576690557791238966336124138,
            9467442723536414317284708920618272681276060542435710102044742358404106916509
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            6891484634469759931920443779387946757453345088098949281337720592844766457803,
            3851047747522564248975607381403978687564658886797387207717892951225456530487
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            5020681026170504060709209816191210470049931235286127735311747781834832776150,
            8375731063366789035679566468273342390814757733856213922856404062446854713845
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            21365876306050519478630377539154349382832434102264526018439166659171136580108,
            2580201789947507801359293376151615380577559078671858776667107317660657325942
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            15645226915859531553679403677040858518226912174701766923930251584721673005114,
            19412699134861500385376618109948718548219777557544815560973724941572596312254
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            14403095683637776582123090625771883870278928545258465331078735232612913791757,
            5563743302016296110865121486706104914179363045411569541472862293087267784466
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            3872302242028301895274903837394523108208164181598236842438803858558215547529,
            12023888148064152285585246844748535435979099273999721651038238964901632946841
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            19355527430190498452626639957299835969546065407064788321889980583654597662541,
            10454146132808094147362067194393633728916434038555475428041885494507601689805
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            11889127733207566917392714479291708479538250393582424668938980244005913992967,
            15618646494030563966192905852003684872387513651506919074449759282551076402912
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            13202344075879787343744789012266000813625382596520626744219288625545315234575,
            17845847196964260048704531463332573264328474280993519961315211927327568702970
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            17770133066049573982698899515359703514690445458346743603940102798177097754795,
            2678310180553433208789193718636584512914702532530515919274904712867067422888
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            2639519329795326665513230718291345920564723590587970058026236511655241658833,
            19629309568851930133164914032458592344961386317566805885093370636110800594424
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            15749365011612798888744363229203044240758158101919803956870668675856217194275,
            13225932711564952086160727065642184128492906108153128891722305524038552882840
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            1199462944864279852873672484493300757369237610684516231697403613173812678735,
            19531119835642622332441389854940195191059340085504076673290242937434555451517
        );                                      
        
        vk.IC[34] = Pairing.G1Point( 
            12274472300830056571912695652020511393385532832953833982621830447033039738434,
            10840790382862791341000967149047945848129694075349366088832062566270702330034
        );                                      
        
        vk.IC[35] = Pairing.G1Point( 
            5759114562843042864944549148395644396419559279832922300771390130838005513118,
            18981848779366116623843367713946614607760669827351692702215352359092551888586
        );                                      
        
        vk.IC[36] = Pairing.G1Point( 
            10818189521974812370336472006054617858600381333484864665381773410033899043679,
            19048645451251262210876524847656320328841521994987939453075981333143209095618
        );                                      
        
        vk.IC[37] = Pairing.G1Point( 
            1477224031286269944061273675079199093978117548830168737105596977101045124372,
            7628822835438170122520635937924267907283888084429440171609802304282661214330
        );                                      
        
        vk.IC[38] = Pairing.G1Point( 
            8524763784356844747381395876070279387283050062356546904765341119569693498274,
            4024074852233663801569436266226836546963281269244623282355828391654987250608
        );                                      
        
        vk.IC[39] = Pairing.G1Point( 
            10351198554909682108460602421359313718928830393007303473884682290708825248684,
            4368506575094435598374651512162366756147087982950460317671389937525365406214
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
