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
contract VerifierID8_16 {
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
            [8115846440117805642472302231940823031974195494287614178167316665229242127407,
             10891900531954603595947490449477554944826181450787317647895239344358827537728],
            [5409430710376891891247015712088869353417368322296080935108716220089074406549,
             13213976328104262830685591057243980253003357143960142407310750656593792686615]
        );
        vk.IC = new Pairing.G1Point[](38);
        
        vk.IC[0] = Pairing.G1Point( 
            4980037594161923080267721946294647941002764391965680352602514219473166911625,
            245428430372290317989444556654652137808942025245392051798661654459680679163
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            519610342073397153474082597917222741113752142330119108815610395925755738725,
            17757506593768532801508494069285612302497571799202860229612456368961756348654
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            3521203727757700375813281839241524662560775761945993928317434623681144878293,
            20952857945879190670226572680181378711957112584448982814106325081132417013892
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            7048078357987605332754180957895170155721932874660247490217381772843441104314,
            14807182718499105685981077240681260908623425235130532691876274470114076144356
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            14597752465655408048640061848078149891316219400445221735399031365050041798941,
            1649278057672758361545476424272858028123062761250951562478153782483296656635
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            11132002511327637947584636233902622534624672751148371090602669569737324461056,
            10611832976060197195865134733421790272253164756893058504186374748412147574069
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            20583892073531826743335586891589474110200245582702063923399938342721981170957,
            6814313613739272883328188900500663900709504015844056375863443749507958279666
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            6234887903502931380697774222358468851399749883371677090655416314554268825580,
            5520729702079293704908179351135462924881295861368372181357669520259906086747
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            11715771109745692943855142388367675759794473136193347025659729471668543743469,
            10026636154506039517224247967425288553800955375090514886649206289515546351099
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            11301031004777332802209380797965216978011506284916193026400584745757808039408,
            9416317779050565623699640199917926154072323918371925961235564852489642720583
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            16637449482856003327625230550799294860675281340037690051117805086245517706150,
            1702696517890638220920651077764776295261909366713378563353196041752520324859
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            13868799576221360039212755372162937351245824625096757322835796062200548313500,
            8852409212303676654532582291118297261536400457913641423465754115808165110133
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            21257283662466959424511250615181293266266074116200743440445817561194165654921,
            21573188640697420730568084654966860159664653977751451196088941268969059120217
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            17781533562852425971466254860659021525527589050503366579104167864473612440422,
            6088704081862907551779889291192610633049340952064789445523388726884624077239
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            10644178890076138929664329647390023948401571432271770739432078357920464056657,
            18183115365506366077413402186328934227261187352930419423918656264488729047354
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            17637678083286517860447861924608894145678634539936432189494535248082942558250,
            19248127186915454332520510528331260870269717727542421606324316821682309944558
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            12513952971119343842134858491511162422279294232036315973052459641547696615849,
            15162744284100585262806139191931844679600880008076248845982137861263877513099
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            21559191126899356200865093559999201295468280681089756359569272941158727606202,
            15658458974472962442473846754061423222057664065461185119079223406420789163709
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            17865672388700943626931296074670535185910067711585778073701620018184890771291,
            18302759803400815721710908126683735937951615456294174737447707393770006336642
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            13851627245521481678304745708541997811304413497525303203943460363188893801574,
            12331574337894625070664568577649399602066610070511166526031261888799227601994
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            15604383218872229475845511909486925341327329528062383194634532309159235134844,
            13642278684980318439877875201143892704023461436663560705642772420031006094281
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            1190505493821633846260411435508134064656850929889910463304591876488110039850,
            21189541509825161301756882273828350796170389768532282461337140644607467705358
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            4111425946278924235622005209380271567593604902338225300361691258680052626448,
            7166856289771882968272164836497269125321394159374209590947152859192547549237
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            2887810284574354273241589373650617878224901346345426760485308704988748475727,
            13253629572234905883032261599129583969958376942099100847178228078409685827073
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            1977586393428825647722774962091604720250404175472834770248808777873899050687,
            19677140478011856001541461661764004591571441481806550639414003616466788305061
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            13063022205265208740569865945419941205108045470546891204066079287464262035673,
            12549448666607889377464149244741064620350685638862685543575626860725873321117
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            15608852795137141869545834596120899403187257619457003284359113474958274206035,
            17255819145843025688769738118233061976878936917698998582824945330029103007179
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            4271153098561837850296499640306957820335036302263450442707720534554768866558,
            1900943216867657278862086160625800563985645298765256646737505619658976432022
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            19142974759333218324680393711670955568321404462870521074771645654855351136439,
            7570399968138975125575529624979670433905269209756427286123162194459674641604
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            14321893131120539431682391132142039546558379549896132547369165369604866775333,
            17591252391190468707792555578602899415653280492667670143655459353629223734359
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            16059609924098000602087285531095440064159698904114204327330086099796566915279,
            13023843257475308501241966165403497704956144937618613971061582406629129493283
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            20399337357602370755326774336835896853631553441457843307418314344992808368557,
            19660157050032512244837810097459338477787053763872680321053303872708833311654
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            3511215189190911192826528764248523776841334318738617769949356738244311139220,
            6637626934508087371788823348452382694339478250195169618562603352802193819412
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            12433989481200944091940570442551813340920683866102357777858944072886919862529,
            519711182757866467161717703632906654670703264744673016995536622699641369992
        );                                      
        
        vk.IC[34] = Pairing.G1Point( 
            6019616731299448829704829436619339973285405614729582031123043941868257082133,
            9093562897376731065277650996820396744109822525200238422760065014722933706482
        );                                      
        
        vk.IC[35] = Pairing.G1Point( 
            8415736039594982925875346223779601916020076885547824371478011855781584522139,
            21544145150089513432374620522610298073520715475573376827523571532541599004248
        );                                      
        
        vk.IC[36] = Pairing.G1Point( 
            13857835335282773919485268787263072836987469047290239970027568745344095167543,
            10265630144671505958574006111935339880272205126337838655566093436920387151141
        );                                      
        
        vk.IC[37] = Pairing.G1Point( 
            3829646518855184594767038969164493757504395801888024012112215299178888658710,
            17821747809596721928858509015986060772748359500570858543925833912164001940152
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
            uint[37] memory input
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
