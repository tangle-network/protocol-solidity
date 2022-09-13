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
            [21480439584899813709343579786821149872225063302221773130138443021874991072745,
             19832216195288537624137355393974176331833937854646168851342154919347244183152],
            [982137638393590113690852392108979704563982868797246920685472217061403114812,
             14989687877815696171812381720714513879434259063666555837248116616358188802340]
        );
        vk.IC = new Pairing.G1Point[](37);
        
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
            19864072706041728596038353092116446853801739653727119429116005028007884632246,
            19145707545924329922425442528594649224991015108780330313599437536316291670628
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            15612991615394959720774374600129962551383990048475544527568347225470013209568,
            21261176526080115118187697287002173316892656307080207931359623969861719820582
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            8218317125078326838081608646593267429257515175017999972807775299719629014786,
            13262366299882629891707739585659098343846564596567510313953527899136129395586
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            18697476776263123195009762193362327576879272095875127846694310721294516137454,
            11656602235529388452524312942177927616085238477273352862347133105453219528050
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            20389687341531566966725522823881284921314841948446083137761387420560762792443,
            12021996650926808470185354002539150178717599505437939318413389685938747262391
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            14063940562118151099694797976119631565857895604510770562674687521233716506543,
            11879883341708180713778834657269251680872446214492050714591681231367453100586
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            3289003284137447689692770223299625557147988109662988538640176363765057368070,
            21389687392156891459404316313434275478145929549520158577520757825216871954298
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            14963672725686717932725876063967610417420671772092802969974328372517232176796,
            12701510212146307598253879765579947234088895410233619708839817728102521364919
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            3722954067074835087158009353504612099055696262371215016631693791471867885315,
            20374900222990775320151661279632603253397691244669686241880052196887270625230
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            1052719200848696824255547218217100004762996583711494095498016288678539702963,
            5990873090670576675735566083745931908931480576747364528791303113723938626223
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            15418935193236775882516968279999198229162523345655886575400811799757493164665,
            13887231898306993503388564804602700540900059143910481611689940408141495211063
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            17838721436593455250738895056013471335576069850284421229480171293378560373116,
            2249446448199104411876257000220815247457230127784208710659125377796988371700
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            20819366724762074693622864849971776454198414594854048970914223756043213198816,
            11453920463471887624566342386205029144267792952794871034498999465284751015070
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            10670340305134883596837684028294839056658593892305921369595284373757928848955,
            1133878045128563948658257631965065735254258101716206512513000092181794547180
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            7791558229384215172409987919393043524730238877612803460726162291616197427982,
            6895048447210312518671326837130695740326636924602823061756605794393963404753
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            13644758264426836367584988664470439400955522529772556168259248167562190207088,
            16669198493425882609250705003092068815707599401524104248164281248356724882118
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            598118532120170423072548355872653673196070032865361299376154297046484905077,
            11182802918341991238511984435175870038803054920549725567874963841510811240198
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            13464042684766821463052817017460686601134500866944849595505608079835441589665,
            6787381665950321912890357224669072561077467418160167925515095222189027928894
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            21187219601578895649159845906792241122595051462269211207139906375751988953725,
            12596323005462565599778996407582769563910370529907210475423314085770032163661
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            5002052321746046362430164995008023633512292766811175573108067335732592518184,
            2675138417308026764372812428054717319243821221382312022723574431003974681791
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            13237480625296645457811231418244110526905820068825846744286426348161731085172,
            12327328884976170047842817080625784527056144235037168199255162006734117600909
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            10325857986818439637176300881660194722003496306403448511390691180921370483967,
            16025528050393446753136842842263546160718723826019195165024985748278779074143
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            9478364144409317396394684392842002632594321943014109628745914450669894378279,
            6008316597665238617827199594388033015548186551947155943332761075218888391008
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            1429672439669884807468202354259630478475361769666815236307182363563807741539,
            20787377129581819555916005909743507667775818788864819365665153130372874536339
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            11429091226814059200330456561733491129291266271112338439634729991024976996348,
            4767691059036397636395806560154612555855613540368733426929144142212979523228
        );                                      
        
        vk.IC[34] = Pairing.G1Point( 
            6786032794867000102818694822593173286762997869131216586723543906306364528139,
            4680574087039987483284619220033012520100239919173481096629480171189136765631
        );                                      
        
        vk.IC[35] = Pairing.G1Point( 
            11743425499152532566376967019464946310286651776875906651258338656694962932016,
            817930620387719470655831786718068593904131741020984564835760694877579609721
        );                                      
        
        vk.IC[36] = Pairing.G1Point( 
            6120911277358460250979157207611349909029829017106451018368537663074734862992,
            359955416157810200562914014326571244582588923022465328482201498272890003840
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
            uint[36] memory input
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
