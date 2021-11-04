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
            [5134119977180951385820969826319733143801565970166758952715739282152705891255,
             8460755300989407112956938856004005404414170917052517659237851864144197782923],
            [21463652385807543992016204060391232945719726247846297690475359000894063323634,
             11758015066412175830044201998439130503201243106206526805960179729852203328225]
        );
        vk.IC = new Pairing.G1Point[](30);
        
        vk.IC[0] = Pairing.G1Point( 
            9554163634042598297690410844589358351450524301312055764711076826672609141444,
            21427883867840942164071980109485419889280750624080081570162594826465078457667
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            2273436564162334707143413521567521170785859941056376231107300009337541721721,
            20766903435605337455072969445466184781347409044324462313211319594493142404995
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            6355235657149589771713922613799027740278929413941640472449462456275761954418,
            3392021950815396279371270023642830896244585409396223810485678839833415779481
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            16165523087035417275226257483538033207427636273833504215739805346193823291450,
            3607387966897384102400979025386216327354268399999341263241986046173939088612
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            1345515484225381275566546810304599246993407480451504389113272540175733630644,
            16157798003780238592656957945017188865104694922764833043391716031032081815438
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            20347814328445777190427306941136552371688734516509504355807984551851929071438,
            12694962322138397266656553622585442658174086138759579265577397770849509521934
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            8753772747856034928626206478806337801416051750797848436371183541390079463191,
            1449078029762622395475432817933546564842572095795070846369282611850271726152
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            20168842444273552423681792032835364704110934434409937568133713256627229839519,
            4078040618918396941999352273020818371373740591912530295589622445079409357749
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            6534109871735882685087057394063080397816635380764941105249219041774150873349,
            1011533585677106174870341821045979231669127425874980448465509435498609374020
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            4496243631307908403536803582786463707947043903127993330490822523078873357985,
            19923303871472204371309793914585875200823139300651779974665426363785995711155
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            12565231913349824344805266340491210717848324489493091842049111797445979857847,
            2240511797253073126525209043734347656307136201388275384257794559380778207445
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            11780165624000704063486098678211350073731995587785672462434245978644447387436,
            6042970988524461731425235998935348147046131073898089542873002940914202312765
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            13016985429878866142353075374542366479839858283462695643557443943250033333183,
            8370672060830631918960911567866979064127804299782557566441103606121810085884
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            21055860068150121994574023961115700151649292673079133754318467139731184856207,
            19013639031061515504889862585927390285705967080327456897683986859563633921738
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            9838950092411931005556022665046219493209753331130315640665785059878323344789,
            13634402679103377906243687971102989622718171047884056335342223845422470610925
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            9096836424553284946289744968500151586055742235050275212310033946734818583810,
            8200107560247022208972390180225125335422898669295866441238226655311103413318
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            17502007444187632442750410369011280949313636777917753909447064928660784644287,
            8360287534928849934156854815352156232160028522542632699981027396151998804985
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            5507358319305137705419921186371611189885568459920733343455363939464144557350,
            9254211311665569602669594266758442284830994259183995306017669397546694219395
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            11449323599620152011463318656443912863675500489330654798621227206987933750730,
            16924887780774413114710791201523870385963180026161949706745880494173387461100
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            14817705812371850971166906758462195681061952886938333944055408636228606613248,
            11294596148554910113077021809447147408457617638840593218988713421303261395742
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            12013527311597543839568101129574958899436453316893865039265058702439794099413,
            6930834378459585798507782080772980045740178908224201999952267478218153761675
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            1530996922674453078533081535453301309248974518090500122197906051745021850597,
            9084067973894529241091712465560855755307022422015375091567125931812868879844
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            5461213872329121147196668743659672191952275662329423560416108675144950808132,
            21646942841073257426091066826966776254554410821325612560683290860179004431776
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            17832087863050695709431501189184862637533087636279222888825867351506208744020,
            12296965690850822931296371987700954148897939346102152277335320087655927389716
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            3427952969666693347943981969487512490309452730109766320421472192154797655375,
            8030483690043214545063725701958592540848122625998230449539629303013622023300
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            8435137382133223595177330750941059447456256250953507337530714719359445467826,
            12408558398433661039951730474395551190976230744513750310901611302025682678530
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            13406866962627220051379070610981999065420502714915515030063699200428235994643,
            6533037520054613439978776933479333305805457075339056417557570288724387224750
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            15134383704958246555368180535018503501430633687003514380726428454654815905863,
            2239133182350626901877261015882922190791197051351304006907523203126353925805
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            2342351890666415948311318864565988793929750113033484473784790442230944191614,
            12321657858968066035822701878715783626489153239540432083929531731042686693904
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            16043610761223292082865054511986895489350247647124406482938170952377368038285,
            10741399919165352339565728984099098876792509991004308304589515402529580046956
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
