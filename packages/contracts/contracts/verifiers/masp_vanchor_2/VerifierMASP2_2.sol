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
            [3378571352579516662437449680659176890884252384324031505555551817278261501487,
             1771088140526740730723244566408379644459073951723302887672706099393982434930],
            [18365736583445443054327833298256105353120645464121143926500793005827872490850,
             8350028265321650280204145948946355290861542871738555630301607424398172190700]
        );
        vk.IC = new Pairing.G1Point[](26);
        
        vk.IC[0] = Pairing.G1Point( 
            4337502213851144261780526164725249802498103995690843419007860822536009642384,
            1351705118989668728050613038543611128433827036748319067733466441246150477724
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            4970555879449406908689589503578741116377972851199006559409713960731305122893,
            1835417656188402497249428132008613789700877095158265635146184119149537547798
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            15495563018852762046134006426220669668679917885646130862023926411082099019296,
            15264472058773853702667999883112603346545123879006693437313161027055968829175
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            12559258512634692410794332779648040858147512226803131507030072162403841837922,
            17515678805128427080758025148306059357754095014144527934478992240157656308914
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            11918068849164568243808191149980815220813418280042680157394463302499657122397,
            18785001585672673715831629161694867053230297198806257571358344676095849958758
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            8151541976087753347638861664932716645048815209943879718261626023106222210708,
            18776543627041282887902942244255847761107549571714485700822357020981142883595
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            16623823968397676610930465083120736878788452787080520215895931905355949065855,
            3959904811892636647837972557434807853884612857726674861406520210083855509645
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            20572687715068170483601482310269909783207568320695550162944268227380497103006,
            14577646551807556044918828696378893298103290449041580363528766335039915622268
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            645046319509991324796177180885572361748401663656657207537634863504273573017,
            5772640412422025840076659508423831249840916067656165398737603429316310296373
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            6455141121588302517144542584265021390461301591685995026864386672220917830019,
            812766703593649301611528668474676915197391224238412909915069393507485004277
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            3712969060970896984711338752033440571891459083431626452097717413161783725666,
            9014157499472870212890077400603178892275544193162880570348674059766676042222
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            13255621101487336456009216604981759580956310359770572939242357714240278252059,
            17243579075214384225590126579713730767001680046488878329555171728302820902528
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            19173822307693756134023667422933488082186125194695972744057197386249910807925,
            10529737810903135575061744051234914114478393185775530195980512689667568004940
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            21538907778066661647278543226176501875350400974121408817212222542763939052387,
            13917733979673303989799056400320877955989431741394770631658055210769210655543
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            15831296033521174414751951656543096298499352370632706270514017021393338545112,
            21688891931152989811030451967286598464941633901083645830695741594671305691117
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            17570136005924863521401733448522942032625741336816104916063724606876493679498,
            100421847203452948350310654658003708434693538782763205471532849306528826710
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            14003241417301033921058136999178317145929428936463193399444711023853265886486,
            13575603819797712699518032985697615625680271246373728137658643255734951996393
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            14710836804750188619879496237731765078836778234348728517154034412655763001737,
            2002508213862540394694644991985819505870573466549329691598813801198189825080
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            2047665462265544060469294428406211624622732642671621483190858111445285956906,
            14718512320920060635290294665747059245072002033925223771980794911803650092895
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            20430810404784933254769214243407828239168986874128688463971935687076572009294,
            14395298974606072557683206944185636020219772908079784578919763489196054683533
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            12576497943214954245922281717193275744010649757732791375692973743999755864884,
            2837690942520001939495178138754815996258297091861572315270815719538532928498
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            17228766670456243138455293536866106857622392212022785303939042825392113228616,
            13303837832162240833773110123838435120322021844492556714810636421369266209579
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            2529977135762105819068343952693833492194556434304145593380532892764989780901,
            2762692319967308307324919245194521630925949537225592903272468825963447265945
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            631333055657191243535839341586417653810947127883212896498635138245674237207,
            21801598742169368879159257165679465377653764459810945269118906460388870024115
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            6865174273601741001167663466811293290061848803826094070666672067789576632935,
            12099323197293258831120748658067771675138672919552778625344827353151089147470
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            11062580237259032154594261395969947903578886571093615003726424041232561376052,
            797079536445996935510070261138052230283609993317833098706777010435169115466
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
