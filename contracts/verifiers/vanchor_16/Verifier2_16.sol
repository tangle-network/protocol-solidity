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
contract Verifier2_16 {
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
            [14820684904706348269423163813564451784707094917972472646168271499646047963477,
             17472528523826002575232433263485504705925714881685731848585361456832499638585],
            [6883299400740004079158163322737997181273949887008923619443003956517858151641,
             10087966715751565359136466492633691492866503375285416857102212413035456785494]
        );
        vk.IC = new Pairing.G1Point[](24);
        
        vk.IC[0] = Pairing.G1Point( 
            18503978911439833799719135194860547485573142702879219839142282389483494816329,
            6199111049369251250276591023427251641856109259235819195896992675849890411784
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            14285687643497735150744286534491631547098471891672429561143958995994935227809,
            9446005746471295792942221046430807412580352176546519091530509271719102612277
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            18039160536032644071565667688320256292890564437268850251707235272152359198250,
            11732889143368989956210380888482767524996799201310723362942409885058356573789
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            13503457840719643859746701988966140016849556969242787990111320359233071397091,
            3201023738457493387949923610336174323329669606206017983459011937553494814664
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            12438259341089242749731897773583823590525098576342782607084388838071123957074,
            4784853503723534935905356504083711292503389999626516132112845966548175297537
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            7605701012833072497058155449800740196450349361365910394323055085061353295387,
            3146023440328812021670796741715524233885560595343039108723114833688806943743
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            989069517128253492996626231837212141631312425509998786514814548061239669771,
            15147410739025314039900518112270885749216091721927801120282227649481596174627
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            18884350994695699431424440609663038380930127786898568481029576540525145712466,
            2622543221778945675161270989973715515378439551149920488681902458638882978814
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            8297603780604485499434286378502520577695931169470693048206512797147239194287,
            19009725958188869721364961907261749773187813899662371187131574189032868657572
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            8642745290176101140165294554522382116298769628810120075628277699564509769393,
            13634656995053742432277413621841767073447386693478259854924423066579518419029
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            837021101858798521977761145235658152460991661396707346684377231247474396040,
            16172040362548470163083099471476548059186253026166621409475306592788732050866
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            256767050801043722959345164131856618304509544323334043252186644030937425828,
            3200890148919824950115877387044901979526716552115418882205689642533403792741
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            12152509643541685042725827886058148288971624222134440720240873474695700946281,
            11145632023709220318650327158201682911928904629538856902016931539516724779398
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            15657528206171203785775719663680419973979337711615487177987576783631379469857,
            8663842421840080112902016236877026468981192420821352817693677432451673515164
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            3576994305092568373512692606637662391958104712916196985458150265811385570314,
            21616441315653252595147191580621815644624473827301902528940235961372691264244
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            16450104179352476107212996060225853319949810202947050393302253853813958794987,
            9304050802934294364250772160250481871302030577720069136250843103539179485294
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            3292294993064956895333519782830447379562550395613896718225791726572338035296,
            3329292433533541939196767831704641772523270313449364322769444536967954568833
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            3315062833164201124662572454884565711717469105325376750542371206964560617350,
            735941266214793076514464471680507067064406881526247544524717463863458171933
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            8150932712121471813219590941186807070096141080984980399338442373345580160399,
            12475409757828090569076449316880884629662941666292025992305556291125958711493
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            15795159711502069510372507139014615420514149550126707925552162089141394939931,
            20245887337035179830761803044323367972630889317368207326711597340358138016588
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            9484321313830135271598087214018416080258249044258134618751301110290290301883,
            19199342474322512928550552941912382261492551710023654153443086865311367641838
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            3693881368627034338144474560753218085747731989541946749672886161852080999631,
            9106250788160294615323237743899775553752128415402671992966064746963997395797
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            14372670617998920279398332660599974769044559284172415571702716013378388791034,
            13827894499784667888790312995081385456730478533422233314018689261786804158109
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            19518819514236873958036795043394438777206707051637493197426850247746531197206,
            14687531098318941201537288224645387777551537600653558792726381265117339210005
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
            uint[23] memory input
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
