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
            [8299118764012084446899258499986221067022595813552583363092951620551227832419,
             557923912500520734954332826051364855749761352587693057034393125739718875300],
            [14458575435458344334814721483708882891955997478889184084841253717884656743145,
             4032082160831301759757578400333245143072722644592632881808149719508616220197]
        );
        vk.IC = new Pairing.G1Point[](26);
        
        vk.IC[0] = Pairing.G1Point( 
            10738987556803569255416143210733612158119180369732697934141650508334542410227,
            16018756976213711998187708645435058050662150064613611946771280956461968090326
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            6918176608087621358550683936065142510959917548197491214451666017498986330900,
            16517293573396486933640772649408541413804120144440178616152806611568817416495
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            8221519502468194004552860117262187106727465108435322093294720439288902515507,
            10241948386149222267081333556163126976464909470854955231742888222595344268561
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            14973431228805278606160374161277471979537887315796097589995861932459817466885,
            6648598088842689123597332173335248369543255879257569697071968673500747900588
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            16507301456714114654369213879062566496465974380118539957066171190125175098248,
            17307002731094299599878954086113240032814283129396314764949544192763879658579
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            13511854404272762168573500096154138051395137502600024203769481090322845893771,
            1894907459036133519000247657504145381612212056557002536651361484496562753239
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            9624973837679967573594006149585789921057582362621882170991451088414417515523,
            14999792755001779586863757939156787160686769139324594514996169793108455789164
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            14787749578705596883005043783911936511167247409380605015743930259514232175128,
            11562219780185863742040468648778004360342607539837037014599927667730488443672
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            8645180227393764519524355133693510804603750137399859074340362883163338944033,
            16468544443102691225741727774746507969586040153407868148573492501969965902333
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            17861000152983058887241108010293675472264712810072818432859191912610269301244,
            13043131275936590229738339109445080236253165019257974764821604334024957515575
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            6934301193303010791396052569015602928182252373266150253953679390135197778931,
            902999198426860860519768104726356882777977554827384333176279291010141172022
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            17675917001902243966928917824115117764109918513400106022110132583812477182480,
            15994219676460991745393780513116859520187487502932279818346287587844274292942
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            9210309718613495857038755291915665135840076099656523703057534700155841538518,
            8278171713279292027072353767821291656318887918035273846574328019322899325231
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            16825148286520620457522743500347665070371122925465977649493811455075243727996,
            613089598413458842974764492323497684674436826233863666301782771079739518840
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            7306046256571642643601721537165805196014412579456809249120555294463489144936,
            6757102570609650218598918471527644535354166305229883781795588956973959586825
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            21679751028424465467783481964778917124066516047160109366951760795207739317579,
            13310790057328656042209198396827508441446937699227177230197657832012662920571
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            12154638398713630417601763546328245262451005226264610912175444849373674284583,
            9536874083081397211443684245253987042237922320531123391662207260369048285426
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            6000638398783227105574526279230612244792747455450687468019019372295796729211,
            14875032896267032957785999857829733942665019926528943020376401749418946048747
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            9865945204560914451022506810850881097853513092396592734389553615301415516200,
            1973092581738705953815932277662880409824751970559045460963346193498566564169
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            956138311890602044998662358076651958985019682273704575097900914104691548366,
            13018330607902910430511877464970453435075379681185364719216006902232632962976
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            11362823716378507700367327294344548133689803666542880814024355213589830064687,
            15497917120829857011248071934036345382225843375081806390588146977309008937964
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            12127075014499638708463137295507395858699507874631197282577795246009280654719,
            3429869929504385644844629089593062902673844355473525924865549588577924548949
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            12277132299632430970992882245422075248428807156352483985236557590844304482213,
            9225332622346225783503469562901571754967732444241497364986619771368437221921
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            19228422219228420772517799640618343707184352800815013169025237590767488476670,
            9886822027546411607313661067859134289701981786013439453560447179303027329458
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            1758106052693838698364379394498110553139752702828990055864514943386409302660,
            14604383538304030359437630405841093518273722834088168188059933357741864770757
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            772907129072952540662368941322372550837280629573804212741022258702547154042,
            4408649136205223288469668481011172931468200180854947553491531906293546634335
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
            uint[25] memory input
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
