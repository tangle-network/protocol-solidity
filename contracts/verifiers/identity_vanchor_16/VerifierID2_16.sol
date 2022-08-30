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
contract VerifierID2_16 {
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
            [13205151174347248035414740450882817504087919003894239978907858982585336765244,
             12789022251888861537282587854038643759673606618111704936681405514369658175051],
            [15373690216589502794100842065157586573024640550116011678553255767196820354225,
             21552845190779115243704785827658636302402680701459244657373828230852787654179]
        );
        vk.IC = new Pairing.G1Point[](26);
        
        vk.IC[0] = Pairing.G1Point( 
            16592349833106684955623505437166367870141692943253087225735442672540335448786,
            19013099682136264910001226479951239075337122616911025789972279745527885441793
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            2001248331413135026992760009006827527440795763652982607581990419647476675949,
            17977856118469918280500516616452845665528936353991491322024378287079649290786
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            18619603627517028792533885706131924387019825267416521662446856215973968042002,
            9891686273561686810604802206339910022719069641124762679140576123948192554097
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            2112928184324323263749633738216755373092725903422054487343947619001335430192,
            20788584655870011756661732648182282035471603743801070569570485294390963533358
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            7813810793784280246710865098035761167551583508469064512828476689013409570543,
            8115829987449077221205295886217370265065007643142532411316130900679953812478
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            2266961879981598781986648782393171255054194280976327338315606916779693832526,
            11697992403598480308412202709503076713300004713946262126845206421100571421408
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            10445271667341682658789396207134943565616234360374098004053175666035089534206,
            2930869829347137368089053214233177811792045725114925948358687682478507598740
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            4646109408164231165244026534254040000651671066268362408291251130000469668791,
            9627604360565928751669127107448112047567674698959156251288993115072306703445
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            6340224162920612440671327729153193586792215917828193788136876822325702224435,
            2890279451440326896589504208705713548257880453086176711946742272210754730170
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            204573410768045065461714768890865840515611354130933614139406956613831106729,
            11767103726183792496426116909280211901489608025638241444005816246466077088729
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            2733507705618130579570089544432815601909073692802923613499168554380195760209,
            12822400586577925384236914791444368071920292556632591504836999219713345160117
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            7643586586611154775410345215390047228620138714737787326817061127303552124097,
            3072326390860121061315044639856921587869908957285298797289883206227131349705
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            18295527244858299673377147637604308561561813278926859813338988264150565388250,
            19262320256246211155968056774999298731995982178193533879749534743401762363939
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            17424903234143913771183320691683799406492542458585613614561702700326845961636,
            19282626455887702283487718526778483912760817100866045888896753154671884585812
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            16551900118374561158498376971790578886334692662362130589280943846878596062556,
            9709531919820238802478893665859952201251583625254291962465688102314270213354
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            16245340564810493102628275776016233169991432243809844335905402306153955328476,
            1707437935469569012442847437470844816529618469264330268444124764169375524448
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            4028228114383298159928040951259417996099108625022662173853893087487964311315,
            11957355520923823117388259720916956072281241688153299327464438117002943635342
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            19749546244324680164049084962282792241048402403932712838737792701173668639407,
            18243803882882120042504281702426613780062961967422485163489539582072980402400
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            9490227619428057192362743156294278669099892490575525939307684612630289201280,
            17747113437842083954687519696118328941983780127664408744186859723317277017268
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            20496321583128971714637278645201883405676218835983342304084660715287994420962,
            18047622267280621008689191919435775219856623880029969241118374589570420703907
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            16141281247350107346025545202758198005383419987180219681030487860995999844297,
            21078858638342558298960641620452385588343017405874942210348586997728425589910
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            2397774635872870327676452659126344805690487835660032559554466877008856644199,
            18694672957915422251690657341540654587650983151729521306611426128756272627553
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            3973023965274221712252116691877105535365824790990972108357309993720277629595,
            1765043957491545731976574709781960754445257398896196367978480104360834024026
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            13715013447107912766898503754351194840858390402268599278470220064619065076639,
            20527471203682850828825999639224423101130764048668197243420523237227991052257
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            3256719830184421372636342250072107526579689822537390283204724411026537628927,
            10266347364309645119073278703556320694075485091973758792953360826184968625836
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            10123532368898505312927874131797395103093427412092860847595321771021980078405,
            21121697563237971186243167968237697113375952613357712722460785200179107328223
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
