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
            15635276308160559792004133274137521635544708393707107117296778344248550957505,
            3717741945256314195289865075076907359794502490207866014317755229824121091817
        );

        vk.beta2 = Pairing.G2Point(
            [7050980761034239836998401171330113822559450636994971400449179984680945710605,
             7245004549500637626631429097675336758284887245753968402756783758231816600578],
            [1912372262250363594846622538306495689461171293922464070666397682496221820996,
             4448756910343248867349276404521881079098652604464026018719784207380017616504]
        );
        vk.gamma2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = Pairing.G2Point(
            [12651215087027903068016819944178792488427907097155845519825775325512087556790,
             666114072379765851464541686156471587117016170159297999051285304321346114122],
            [16947307245195946256653020988310552692965359925710683450581682576834171496265,
             2915524777709648250796762782457356659788255194668383741789398478353938917856]
        );
        vk.IC = new Pairing.G1Point[](30);
        
        vk.IC[0] = Pairing.G1Point( 
            14536606401752502939473299426720671620239226265855531221481658466391548100539,
            16569523146151533986629848668066663971426169527959173307767270981193996492352
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            13706933736641343430664905913334257129886446453687709708120058906101506686807,
            6345473462702910633007671051793576304119395780808175955464731446933167594902
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            12442780114969525151550823939800562985137597846468247447073532701931981030781,
            4767731147917368330851438445545981950164383396041164607382859639444443920069
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            14103153091584405865478682103876631150776807070647367121833660928932312449956,
            10450968862744077545508044748745540249500969498266899540733632487945377576360
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            14775915607926193014513445031106596666772841409302679265241891931643037889489,
            5513998091341423527775100338140989236654982512253867543616704594685018567897
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            20575140150831334286005337757120178140779120263658300804009489595218083106556,
            12206770774589907097232437439981543916957273475693585756664376642047543876358
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            13105756850343083164182146601683240423165823099966003682291179207882312685937,
            2448658141031448444955960876006907947622169869175871183123663734048266084464
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            16538068419003510372975952561113695545669314432579780683485332391048529004979,
            15163921300578066748376212219654611345444142076171658876269275532087375484807
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            21331409047185941121757053304301720202453115189759316470466495793827168811526,
            6176864312692199319338730112917533845794969654097094602089956273665569525268
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            6608419261446981631345971866045777448127119620561865377808979381646126476554,
            8725944160357249337219324620220389912517037048477888862964877985138627163860
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            4181323371204564101828922205826560426450977107652888775953994131559515871794,
            15788136797327513299438768433561230662701839595607921447804705223937494597949
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            16658739107371011999808605213721606780210185498302268231639399928368099490895,
            18979070202238502322608559948359077582793192547199578203515724103417096235772
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            18013171175618373497818132642325007404756418261738784197808438485579402498585,
            14188816294598214437134415239860210692480076862920473492016076593713289642375
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            17242893239598585490645125773502225957453745568895356481812633515545989536008,
            2271919448679276064000769115509939787276882104922722824591428574436651941672
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            18385490190308266188466849495901574418985347684463173303702806447328622264116,
            15189843075324962404079925172305054271372730439490759766918802592008407023507
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            15069452288804703835585177218947602433495175900050593806950782602195225460134,
            21044257752266906645919235157180928897744503497202691789308133742829533067221
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            16040220435900982904155188730744886038281752687288083398997140934985656633511,
            2427874816280403793448286002966169434662346756938663506332910084949553758135
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            19143028386777528231848424608707840601700918889727384153895991102633157476386,
            11612590512734098363243576963466130989201325301943354073496597971797134410463
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            672465263239359935597328164846910124614577076648129887713017744512296068076,
            11477153528050635377619204397683554665444107213395881963275719030626335860596
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            2860492432967647363254712630326110853140207348104242336721609368993429365880,
            21830129565564196581492471644113015253641321427596025597476216738178733464827
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            18413226855684702008634929595385719942775114471419375573167887751616277005093,
            8673612750288417314652541284195497100831733686648426002038743438863677401626
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            21810302607970131868736114192551977837320192558270491073172265656074198176508,
            19724687248286945564666848273772551354362143560085337682628578869808337755983
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            17310806245265952696015599043186205008333837114965545466317139678460526609399,
            17096509676441247206444426635494768946982721537766785656141003265944145243936
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            4526296054938525278699427855561534843414032418422875811840168882062145654793,
            19824416150268662300097456592222720020334948729295408349431970295870080749968
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            1022856813655219322619343046185106742620003058137942270331044761754070792041,
            144686933217828338241247939609952153899908828218665834364523973218136183177
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            7299461457304335380261786570737201701867565587566548079932469695578677790117,
            14917830352389927707182302143475851913333229419406325922684965669153217866894
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            10132567398523446058031142634788712346766422326510739896669367216987527755783,
            13875410912487747480872984050090117806997607054811537221664124989938520981021
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            20614490594340684454645762246525713895021805174929691623516366422566520440294,
            7984868035567705508935597106601480569552125953481063209799089946240379103977
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            1499172010265202221969231426183412129346979844468792774410219633146755344846,
            15249813097117450137917378155230627402038464910240367813642246565880167953462
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            3734847990182453790874835502964325089088200704667471046371469062000356113112,
            10469056064753688094483604714501312551253155799035260421380668132887480694638
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
