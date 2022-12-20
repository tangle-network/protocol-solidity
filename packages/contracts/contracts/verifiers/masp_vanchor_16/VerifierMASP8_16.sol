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
contract MASPVAnchorVerifier8_16 {
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
            [17156961494493304338259739074730686200510947808666065521292447631595331554365,
             395284503931858755794759304320425349526764011781976707978945807899495963007],
            [11209714899852517443287846992267616365200601909254299471895659807505403153078,
             18099289174855000599812012198220237444358544728305245704115249319334259336764]
        );
        vk.IC = new Pairing.G1Point[](32);
        
        vk.IC[0] = Pairing.G1Point( 
            5176817753980260979740337521673695916009082155509109132498140900045810490152,
            8793259230322382942882520443605692535019186224980651232887999525324175368589
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            18343876242608347492575863254764952910355062849380102021675367340890565613620,
            1967248391414598419043990809358419475182899131118358121643686993352502962295
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            14494490937501690719197503373518966525694886516343136125416166707107791730472,
            267491954392078622563625199804000066520242152665438226801831671308096779827
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            20147854428770492256392862251308470453658281823280729281500107737157377826038,
            12261538382991274339470319143093625170199874142741336398871246849935056888809
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            21347387666098710931101008926194062882397520482278267641660498144438035733743,
            17371282773531853180063278819794333833366292313260737151393381440033217712239
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            14826136918370621334682963176530390829835453422287566754984946052648668323102,
            3762249780402788670328192035607334710160752340245392799560961808978495907483
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            1850311918500172717135545327588296287098755502213200249852554146918946345278,
            3734238082658458578092499019212523348703406342062317263735620621724263628399
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            9068521282748135895446215968360840390120388131995439256242221539412726449271,
            5650343131926467205518819850537159776685658853935273992288853390015810281450
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            278824545682878600598428224796258813380051094131374011923127189190877260796,
            14733140958781077717326467307809754841154856252809206784492171133201738060231
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            18011603316989128877243599310443108409125396476320171895174962719774559611827,
            20929380741057132813738459779310219651400799396662067010098098955550052885638
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            21853591766424868517325024455676805814145703581647480939088100719413691401187,
            7007309904425318789077469369501642444467407092373883398648539115446648780078
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            10009128401142807992382708479443447680309323695190468568754725318460865217941,
            3365938466831700948797021529567072962808499652479557617918713343459963168059
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            10258301751948953569320699474610825111589534966443194217577944899063642000441,
            6753256926611161622497348294228221056016917655054343378141243516760595446175
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            19975918220396652313460043236564131591998778831466627688752834910070499545240,
            17479051345757276264754932607901629933884496727061535846886572253167700234836
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            9902049934838664346052078804169523096106213533039158107264589111755550069383,
            15291844186556173072487672219804096255485894642357279616107499048475281285780
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            19337716925034795013039509311918450203528436219747278707238843152693251674727,
            17984309458227548535092514556749795822270057697786511876725564582195153105028
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            2410993354039543713353867604795487650568909363557930510622838199960011322203,
            7239124556772131492382747440384475000556759225498427541671823477915142524734
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            8936774955511145482736652253503469335797027489777341260132643668474776849701,
            319937807062955164294996919913808999591094059010503465894170557801470659256
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            7747799747504289205954409836190086671963996203387716324023052016662155248323,
            7765393973046073497666896215970208429495372701712900771956042482407098918601
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            18444807542773619822110716186189550440894920078674151926654782760181235263367,
            15224001822123114656097112893133473614823910794975993142214978633758282743544
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            3627475427102256799184260562788696435884809161477797493000626338128603580396,
            584211159388749123516692106133072726149168148657349552831618785903107745148
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            8414863178942046601876095995207780277615586073897921191446037555027665706917,
            16659337852916894026616507342056748117074236607674893224540283022646444881203
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            16953022344054582101725629605590790041514573161739326272385102673347145754987,
            2992714956396918884427217258397740634337328507683624713943776327759657259886
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            5088227985236009432677675986841388798844200529645802984953148452460256676120,
            3987123936138997220502441133368357451076827039219886429099281710463945049422
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            16673438269021436468651692006601133466444048657965835564521611742672198355549,
            21206716225635575959042770225220122073091339599450678399842580103828333022205
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            4311720971886249153235250233169930712187086578562941482714029848142994844034,
            1946195632932295999934960470084488052298549979929278250581851621710347044077
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            5443599318531848709525931113001648165230271769973733270215108057711896340121,
            18891902895784755475194882788607890357333140722874929791447315588670717409412
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            15643433623560817771242360770851889306575043845302476692203235819909826017211,
            13852329093369661510419692735083608500595268604633125879855435158273685700157
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            6704203427039875892598573582957057037663889795019039069088048695033922864378,
            15346690684514112997870062928113974409936948028507709516255022930805661024844
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            1596928829238773375307556851831561072612098313691687484208019748433548016353,
            13725883135883757670119232605995087217989595390531168616765089197090395545830
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            10596018237362248074694765224248226443443278169732228350604527147317840713934,
            13205523407914379391164754939699895629634494400842719687321198983607408234707
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            20309581838680282645816277657258867731790166410240830205218557695701658628568,
            21400697084964081407572927695246146197408059439892071906994194804011484166327
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
            uint[31] memory input
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
