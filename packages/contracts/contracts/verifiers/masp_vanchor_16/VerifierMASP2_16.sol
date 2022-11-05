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
contract VerifierMASP2_16 {
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
            [19180462702074729436866426490959625703231294283974114256513661058757580193492,
             11872716658380852287658085802089352395718671019431737589229157041919732476420],
            [13614266533937469101763003288197476173123850471562909773483971664514463761235,
             4709419576381928321377075250496670237061698793603232560101657014694338288906]
        );
        vk.IC = new Pairing.G1Point[](25);
        
        vk.IC[0] = Pairing.G1Point( 
            15343344284491743896210224992754499641142537699795745163642548137336848746537,
            7044932874161674155424365563235556793374255996637350694926454115183685117900
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            18122921614512926596747996731219876786945999245171101943622271651935055910739,
            21532681096143411579215810005090413224377169612777118989201060534844395805121
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            15593775557975528928387802551085398439799989790763158486181594527026438746683,
            10541018910877242726520720719929777034703532393742689177726200071507899973761
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            7552381801505719330585000576026942561595242304533526926546775612048762594304,
            7727562369261637869049455116277280965696977048377379378430353492550396742779
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            586909901135242875664940588580483583144371140865508518477909625986749488448,
            21342391789913310392136694321241055008784248422362427304552317852301535039715
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            12031453272505113350204902280413847026745818277330427619416632949907099561177,
            19625925523363700699679824734963454576938619924681169499450180526542340438261
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            14258024005372322658537935326341836427673045528382286292258688824085923497951,
            9422413678605302763494442206158348078240326176521571380879313552928846456362
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            17988191963674578304088145349336316194871229877598929530900954693111195164046,
            19273576222703139570471437007207747500481049142386298517872851718359346361532
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            9016120177394004496242960651611352572242013728700999910005396698409872337160,
            17943495173337349559731285555805557845221250609963597313954948773356947721762
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            833469605386385031660954720350833299379000115142959645222504215680902128309,
            14160571544121820518826824414577812139640451948562689083119450630170923579375
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            16534786220050921593326546756079014555568785721497034218464933372637087749678,
            17688032278244890968757262852501180062013886988593864984697640895968680049636
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            4935065459511975105270131670996256059305064280326612059107265749616727188346,
            21694078147982275686654486143041236552944640570409762190318155637442694946991
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            4975141229936738488521385230313111116162345241735527655782110089604745451899,
            14032712824473083657342149872041223655655462558904353303686364243701915980841
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            8326804671851410475871518943472564054921319522511739757486485129442302861077,
            2962820978650068806054314640809224423157930057801484963193827601178782385096
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            8352508603846624339973740899236390979821280815959846049642696322828396391580,
            4727125801701073854727536632348039559205641742551403649234423593366545372712
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            6513317127500227350048862104399037893059451498098744524368218832223918948107,
            17137043595105924228480352328349208915370272504733626013289937191009893804726
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            3162624093634831006101328494419350596150598161668090847030747181956631637334,
            215524113663406859697608620273681872302602732538663539214002990639859474841
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            1532814133679412606836584378257102743102835707986623002556280336784896927027,
            5507089207706878821010401179000228084258951831092218364563673227675629201500
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            19053188513602985621950192317844293597166205265502333781122636241721539175985,
            12830533657615776899748156265143136925374904986995382757727993689019566441896
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            21613018211484379518285339577180828096044953025229446380441548114158578916673,
            12494523305445231027854540807515532565607677950121009520716523494426175985239
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            16526029509477234422174402104618406309525947908017344363817094513625105132941,
            4728944478088672456601094923728020647308460345327944498030426966930329367588
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            19810829745544574353072063697079836224791757942379963598131199605987154319327,
            12902337886756655386809515898778596837233874384187523970185629308275952462406
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            10649601568203885568648062603636089075413527454982253116182441302990894045560,
            9041432883708426946045378385718605969358940553829739206109056810405457448231
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            3789423282442994149729255932426609296364242420229602392930277094328976660777,
            1377758212534630238371046136447317772272497925566703001464194436145139614228
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            703050616551966465308643417711235207334605003829775405853199296619679000468,
            1580370501823605551002363798955269861916164380295174353920461898063332609487
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
            uint[24] memory input
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
