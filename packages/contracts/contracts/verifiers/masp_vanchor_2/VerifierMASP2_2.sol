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
            [21612917949897152239617150448731113486292555748184554999480356184496159611212,
             6271890765153147395332443638579354315714978299365767394476726140794950766696],
            [7884731974523457586014881855486283525782698825641489647245460335010408351255,
             21816094174720187506436334468935670937202226902061585647616096530238550457669]
        );
        vk.IC = new Pairing.G1Point[](34);
        
        vk.IC[0] = Pairing.G1Point( 
            1787544772747974814809196369619518648049033824252057533263005254501860203863,
            17117631427121381450721437756756015690047847613984502623604064931765107901086
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            19399207533588586952206316152965987670409573696602599075942397234512188125466,
            10740367410469417003043423271155460662874808768181430326744943117082176486016
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            10240859520548529897577632629786832109996970959697636944092266986829330076642,
            1903753374523324439844624693290092952418910542150263698537402043903398758588
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            20853618787433941783395081612039030412716639619135981718657920934233848826973,
            16409233673152692364669553166350928510860623164732211168611250129067891686353
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            5064836584423103958317743051429051139659681360203866036428305036359316859830,
            20221765448321535033204356414212250758662106302467561278634022163540847327305
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            20233884998559348079422023646287305318062886888857242995347709262706002240058,
            16725807273920534840433705772686550134339881136197878065478034739108834791014
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            13159046104311751900840889020891733486187289641193460739442923924635958219128,
            14058217818668949771311013175567828835190501244831808315204379771049935501424
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            18817338748485742955406012532915368760989831822626087071231672719174368570864,
            6266408077008689598997704630780494440373466709926870903089745124727747513197
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            17609137371876271071591877763067358935144150551716551539143704617450185193150,
            4970138225638572940865876087090622369074771804542736880637541070866083529726
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            5644457123308356105073687741040256074863891489706917311526411969973784016533,
            7886901875252818642295203841148514091719433797588612387150537739292574941330
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            4497101265618137920778266861372101385436595189913822582880023415004884125947,
            4002856683803086865622636693559124766314296524194098338515038801470854327137
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            19991326104937458660256414174146432278396226475183153989792558308389321436701,
            14040079126006123003860423740783739491510476879840134621370018600472861134912
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            17142112097849580220599122037669901034064863523951004026038680428461114199125,
            13245610829056987973605345982420877440975285145103551497171885143622371361157
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            17706487323044763194311762845475493548537476547012438969771328236339406701092,
            14284626010557550888213481776169049373383560781709069842395146700555389278868
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            1107362406859068116005816806425822027742654300017320729132927580460764946420,
            1570711807592384803132045073686630834987211715918196712061879858171016198322
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            5716747340160169046361812139704461218876839903503077363103675491885387821248,
            6955087785835925688614747394849404884369461040814574916259899721687095883882
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            332282092858813734204773594899158486245996440725354335102569773507844261893,
            5803424831864419503583561897841240862442073661799322079984304328903067778378
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            7384453712250606942876438495043654129720687341179753742997190482824676097690,
            7414415251952981286251607455235463006376291627485703907422566865085835384908
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            2384957221009636604665443422340161230293927436114574604529549781407771314425,
            4055734376263337049703257689112240210413340223420211929230013003271892036465
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            6261871138879391915788385799612101851702752316047669632897092209921399885526,
            16765402933914052451300860821764018325579793019577306483538989178936696667138
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            20749601989615910886226906969905040016443978325774291741292339110146753872417,
            8434505814894848674337742243237379830212240179470219877762220127532006680984
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            2052548516835755852852730233565754584374022671247055510264913868900866777214,
            5148198311040126012089232127226258511593684826962080649212879341394271077891
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            19336754460246815490416814666176257711333673882135022408409606508668600960088,
            13829206049399413154864619102146975335331022261945590043238629764975839144062
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            8815674481540401308118487180557870989305541984954152459645491801704495243262,
            9580362307449808286868800301968998410675558906785154319507950653758622469566
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            6116100936111575107426768914393761406863157508153780663315824174647082816783,
            4762741068692995434371906112519614423819294596135606069566983202162166310317
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            7403531210612943081027854533977593320489386271309178983361994561233862255482,
            14664026961738958954687860070197396362600231011401411126683946618060255038564
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            11330667043709455183504798739450221844173966045183683320474445210204509433440,
            1808334522661425043518729752003516604722550039058357914341769655095733487748
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            20164078926413836813802369696145595087149648445240397662597597447860896400112,
            16737715203690389354896755069949501548359323335452889997625820216080082960053
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            1734447516848742904247536777760465857239813038380543327627735667800214694228,
            11263279030456978627014187002774958002531783413003046110938747775173091734974
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            18942759601316162419399030432178012018202973467941902322170397095621018678034,
            2794479622904357319286347441008600100216442393813248494028324382024731123670
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            14530796688438660089024514830343238510811531882838998540683776314019693931530,
            5131669432019625670932460799676800777813333631290874242940616598173612326219
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            16671051070288384237911186155552679520747701179858122258409251846420972593573,
            16531737624532924203709187829450291342883960741231127421042678053595292406227
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            6265249805927539035240317997047380475690246429990774982414750696398419553604,
            12573776692561169954960701809063473491145917756255297431427056307731588464743
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            3607457723060594792276512324556089835982072920655320812082352516197060885261,
            4342253103884032574162794983386357107092275494068745798002063813379589555603
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
            uint[33] memory input
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
