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
contract MASPVAnchorVerifier2_16 {
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
            [12210097506550536537752920646488482069061428056125804295980040731733526600399,
             833805897709851198535017346342784089908293281979808469918817774501430035624],
            [14456916362910447753842444677584686601687623606028602199841914875775369882572,
             5805578003021795584544412172316632112715450923169727525619512532839966137145]
        );
        vk.IC = new Pairing.G1Point[](26);
        
        vk.IC[0] = Pairing.G1Point( 
            16719229370606636809493066537793978646561271397230491278086755325081385832370,
            2415617645739932325572565538015851009476545387516746194141500799095496015017
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            16466815050364647294672945369477584591693779586240086033537408165240868852573,
            17982753814403522278214320912320871432690163561038424137121409544610126892335
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            8095435539573023053626894442265389294354569783899052269416080152876069106727,
            18470426714986144911225864637119099725428319013735794597527052881658779497384
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            13493040372420265689479982957763702141375679659368676049779061323352245618703,
            11140473260801677594283731849493460017976432569856966235980255814044704610924
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            17431109096373022697876512765724117252290615186380939723986418203065933142741,
            14237441365527938279139820746621199753486781990922167774560996668772523958848
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            15838319847361955492065426557684305122282649862107155131430492767415158492618,
            14822005677811516893054559906673472082403209532910161020172966774302483210173
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            20617512470306536029611997034350299651680688601322146682325753569150850288310,
            9068077760329826120204199760083003572906538971514471215914068913982543580874
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            8900648273753077067185861617752222295861868875037295108185915001996968941900,
            3694775981396547468763530947276267723639636205094399896033951094987762579698
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            11819209050616362771731649424249912904744015473866248359121785993690413236444,
            20620367352736261354306808367438600047739624468479955065970500864890724906479
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            164276530512593235930176530146080498705140397189714493785556569439389908801,
            14788733729266751333872967274132074572189295903137032387634994974381612216238
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            10550110413793203179188362171353544896873890243774037823672596445615217685779,
            8269891084926227054820775621744413969861789066390121843828025985806356768812
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            6893307660824773159352554804929209359587853762725088656536075478181924590139,
            20448915210045347356191778157786097071741173627857678091590748942580260641850
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            17528347599045087041948731281350958064707473002719986237813913888750076911708,
            17208215151989354082015705259230946680487117679775826193768482098275483570440
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            4173619820775316728864767888856262506674473012570469786802095078993891839766,
            6620146903507405044541898505623109377731281415728059399778347478233658334559
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            3215960292619785624683092657972486350607297113449754102748530757118612693991,
            6139287649493880703838903019901306422057390500554910543150738680087239218224
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            9202799505916193592311055309313589158055519663474416326290574930299792011853,
            6205354083082424527430058368333451411629671084976564722362144857240664023128
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            10984144337757724885278064214933276068010103451857082311805847603093941249230,
            11536849603567211781677988797715069364539159673956054883222063508433022726794
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            20592331241034191342313855451935953237515505799036236514022443789504609623147,
            11276908388451872925553205182537235447652242474065885682073816287277101872022
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            10816220018616401824158006979884670536787470920609423053893761213543731189257,
            21270127607266302119213187158342767106605750122736901909995989553577226010722
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            2719238863313584580155410344255530914252316746455817375405719626869967832595,
            163811128727787575038369991525883319056050054460846105566087597635332787456
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            12113092135308883000531018914778046665831448713095340585984990072123136377720,
            5629437051008153464953440887595601039961243361694805741620741152776039425504
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            3730799479589398663228552855463118700333387712634398041660961054710721165158,
            17148573469790662316104531591943459342621752797520126550042048779890796526872
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            20034744067387889910201755314423621716813237588189492301189847704184724961728,
            10790975603593324394405200872963862386663520247813758320439776402414518182849
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            9896924139026351226282229265555337941518373933092094248011256904579638454552,
            6403210168437947008035879122010582004108902730025886305449243704788076672871
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            2945704316924671875021092344910121534356267294783848450389299963237359491621,
            21088122666116362912962441680874576200353715825719201291932513793146174756102
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            20334815481762779282025031830749350555736022961337179295771009914696987747121,
            1253015156209795364719462958052654103289994405017371036921484582032709819917
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
