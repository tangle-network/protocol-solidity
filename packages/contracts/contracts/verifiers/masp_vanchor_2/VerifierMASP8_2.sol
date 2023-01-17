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
contract Verifier8_2 {
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
            [15016819735172324349811549113430247055573134614704748304418640798138150336963,
             9029955845039326722675181489258670011726414088259012019541073064811692475408],
            [21795472226438301398407359333818875558797060265194632833854636418762304864357,
             12270560546536052945236377311921752110387430669238656761934589444461749069179]
        );
        vk.IC = new Pairing.G1Point[](40);
        
        vk.IC[0] = Pairing.G1Point( 
            8560854086345543666774221444643869252692653214548554959119385795486933051658,
            9148795790636036023771554993817643152772219703721325802346595459829111248974
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            2346417937428205831557675896136696555887845908699419301279232771918136334738,
            992810748258320881868995920264651670188339211197435779495809471773327428368
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            12596537017563181797046741186516901438202340046319050844236371395151425406703,
            4065032625901852058254039775200704005298202215494625022000688769840507944925
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            6393458235368868256418290844035518112672898946084360605408725119181221834601,
            315454263982554292613064637292572199953185968314824689659466418316711886116
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            21362849069915498205099012564190068161194380090961328232086564462585833070956,
            14368578163741150324982367310451876022666668019441335831065595529563753720234
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            18190928014532763784578515094085325611023222254689295902132765287919934059429,
            648022274939996207117989847893818773690897115467981205455304510649254679322
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            10229422458692125991541497159790934673140832997466920590048664153961250784962,
            10486229486272031857950303844455028281024965904655568490558442729449967833539
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            357910851102070647620306922014236902813656131717265951995272417185619552290,
            19271043649192635374989409161383239848628394943688892787135541027314578762255
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            6012792825833720740128271862528884131144910804199048534157040592136127269155,
            21019098424988961957133005291559311562068927875083877064802215863919454728129
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            16863866252973570631105187599431917077339362225927619696480202944374936608887,
            7961541239114167813874206042489231308513051798995807925942576033197732611462
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            5949671811677847419157125854243824286654224712472948815442202617235540664232,
            15152224088482622599585079198711269912228651622924153642785294757928833533828
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            10050597325971976790241354151341230947858244473163582796447911590074082947353,
            17963064953206892250296191174948468391477284538556662552621467317631717851051
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            11920881350953830196542898175454223541777058906507954069556399955151033333592,
            9231706336157479631522168994270602737305397503101101886594233669298113795023
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            5842924261785729690176473621393269530101378672021824843184730367809449608070,
            9605742742072138573891060633893077036340063295631448051892892812098468429962
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            19280513584681869561901848819250673495738925929173996991309765606209512070212,
            8662853032990485482374048752338744617721255778131707205906040469711894425114
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            21707635944864013742755864748941680780958939600268892454618424247079077366913,
            8775559106793388180380042648503041614220879207904986011522936583175868778948
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            6164984434538913610100321782284230974316491386065297423243568208085397952239,
            16244382504362114438201234039373944458986758374592357085150933018870515469023
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            14406723090340449160644083365269462825483859778444030342825579686329565990119,
            10872166078393431716377726182203910819777930360691015282893453935085012764633
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            16833333724609348638887492317625833750433326972264627011161206691848642162163,
            20383365278540359452816238120428601378217046675800805869709802094422531691482
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            21101005463640888544567943236692056622529863473347303304981131204261364113803,
            13248124600721903574114689908306851887852538833728387409254034259226744485662
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            20661006133317568408688920226101234586553768937742102327574692958095679178290,
            2505609565345305930662492533367403968331571798423528219256800487820875340321
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            20773219589441147872786188953007401238171703970439930599972446806207956085116,
            13731517751764652226884300652543302710450488021541438954231780345386156589323
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            16976882863519616376555124102852980513030420265369143247869517583143814177755,
            9048973819700484666852834757387399121791011080211554560307565459424680207118
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            6225994248627035754494982130994284965939987955571590765425170884758313259946,
            8740129006902169845003409467142990909700154998672996260850063294552873724126
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            5059709254565254170515311519284552918491391367083706960477096929596292610598,
            8526704589600435625916457218466702671957972926293134146970193569318932626794
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            15833356004018969810522641885547270067509232922896300420202273417135797025341,
            902165153507459739018209002535449947547639310118249725888248352661803854188
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            20441732717710525138720791499291075566249315883917818258749865503783379678407,
            16901076630608674517907968605961416580223601957976920872184898284453395651105
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            12089439430116620605977929470373500214640061918519873231513178112425484153881,
            6390782377980602442380260323247747263403899900694683581540416448972398769647
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            14446605367386769281663402592242265236434030292900068225017606668873202665497,
            13211060796804541974720460363407975221765938851387717072487417726559753559500
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            6916285560797061504147853167505197244038485582698309658072664158345717296533,
            3066364288506259975763776788921314080071369618093032763148986229047501891235
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            6460285897533998223059292119471582729222448087289886472549199566662048025565,
            6107672754557756393416433352375921097012102012957729065923369898400284161785
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            13639922591836340579271152457877213859310646115843571436251843568533061968252,
            9542317598941536769792775677662817646793602778357598942713128705883337672727
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            160861682292913420630197324033365912501579085917787827405021906506297639212,
            6464041576838611025941852755474459246408320517023781780936791638934550056258
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            9646005844604339219456191236736652375748769741464037849243782044666795481862,
            15701888947773331531092799944110270771774927991331810852853986512113439854244
        );                                      
        
        vk.IC[34] = Pairing.G1Point( 
            6718318971669620584698888874104821682514123132675430970078803771526020062300,
            4682665137892064822820802655330767177945148309260113845771388840341920194586
        );                                      
        
        vk.IC[35] = Pairing.G1Point( 
            12429489716924147005503957494443750353372502900465619859165516931610888491671,
            2444677128671743041471975757499771783551029828767263374566455814364783169001
        );                                      
        
        vk.IC[36] = Pairing.G1Point( 
            17446564355223381659069472722058696603856175276545397471978127889174709809466,
            13104452041858672925026323660550716539401034609834026867755263410217783551343
        );                                      
        
        vk.IC[37] = Pairing.G1Point( 
            1247944404656968553422706800711204908502024512103190861091583498759579344221,
            21084840768874199866442069319838015794737132541006613175003242718458926192306
        );                                      
        
        vk.IC[38] = Pairing.G1Point( 
            11231701220871089729120611916228006182254047459116974739730002673531886470433,
            4261583784849937497574294403949784170431264945141109159759062644703246289033
        );                                      
        
        vk.IC[39] = Pairing.G1Point( 
            5790142820222258554138598072136513699655198608748730038975215573342726734718,
            5878595684921354996187212632824031400952498751248880100068958912416930951022
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
