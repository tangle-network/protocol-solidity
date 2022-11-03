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
            [14218094164716868305873729111377446674332253889872578474640132516623270053143,
             2508776180378170018967638606435675263723027897828795197914221155227733473784],
            [2729393781834482459112256059542021127394957192979527446114345723196799311401,
             10907381609139027668319725469139917772870155951599818981350422308476726892006]
        );
        vk.IC = new Pairing.G1Point[](38);
        
        vk.IC[0] = Pairing.G1Point( 
            13450895664588552036708971481147349549288074436300096573006570879638164669110,
            17490656400764351421618696846174620715793393323120228978737858300615187019394
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            5078498626711059735015917986345047489646199682765334897700200866907572032376,
            11650262732058313077910850058972887580527499882161401061541710523096229236195
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            5921413903015294333764285158507901150281997990897804292721038348419170779419,
            14299203451734936424859776204640844742821123313777289125592303435401420285696
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            6219629406291913168282830956465692927385502642992387572909364644746568093167,
            6723570697172916795250821196407975971987165684323180265474709190920251547727
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            4833223589742194706688217608316858436742854272655220278718617354790088103636,
            7114099040105576856596673691394101298466968670533136337203649916912569822827
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            3156524197926762461999361092004537582133101386559082941977475435088414659014,
            2255406582903697762410889514445195179115268662989992867783669750959115640701
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            14176641248483081161465827092637304738656679469210522893783787954784260930494,
            356308364287309782924095289646880940682444095656373084622959745420125950717
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            12190200200371614803773402917638814850600036594803370738855616589995386972671,
            15508832277269766106748468676314410978483488961392831482404546160576546836777
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            2547731272607859253569051392930484194825513247367248775224187672897557045458,
            18984027592482581579122160900629633862876098385160461809794749696077781646754
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            17967931870219746874746299800707055709388502171183311117143724897350528075813,
            20830742190713315190870165488802078078000505077417777487545655040055368276555
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            4375527235836585093409977152742587278885942220540705173557534358432692949928,
            9553786172152137736294645387836594556147906069464510698727578314876689878947
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            15650829351118754460133893761109692233438347868567908556726530245724350203082,
            9465977829976777777987917270738664434519514718942242807786992236409111033463
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            3974250896717003752550315937830823705297882192893473112982385109078375508175,
            1182271536722827358305841912882745892770653975554440193432262325604899080676
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            18429777727481654856096435066918313380287210807995663696274403178659573030330,
            8348308802526591746919426718827320979807278250119751846272487656651102997943
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            19170572410164971265778412429448270122870811958116570394606152192794174282791,
            17307647701749989268514119055204021036466229763424623024253162520869693805703
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            21128212960224380391997884389342322113402701111913586900670762836174097424170,
            11159054333976491757910646178678817042422121329699044216662552089712488564634
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            11157393442412708398646186095212202660592128978269554749033193107175355381127,
            13618455712049828684677653105410276895197572777477106619435108278678909647403
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            21233633316642139604252727477308007193100835320482352567888441574791218141821,
            5545850937248876137641103047869572515226945609176768773040400986040446389495
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            6307248548465897790434152892268231157606578008204118571910815512211918103075,
            18125408605853654177608969688121445864875598306671063625432522402584530316869
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            384876531051716462062354681472265394421065044881978279137947170926928423513,
            13321913136307018806212776879988478743273000903125732849503237212217839545967
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            9010221655112567472185957099908428623262780821706494586540276395830648820994,
            18875503843517917587066808502634680470949971212551383338937897926316094306059
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            21361648665472658954569392259080109864110037802393658728397571905484907486500,
            6974537634026315065474728000251587152379238493591263432838346179600596607305
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            15439973549924044152816612682487896544442271809828723657638419433515637196645,
            12728572758991806503463266312344596990071946087439406315102059808748662002235
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            16921583945315529803833533505785438090099182287531005464789389520801573992396,
            17930228154180739498419375006600489158455693367538991842677437933336250164297
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            3286279099679051851318993223017304040808661112628548943372576655674076429459,
            1902736740482644908059776498052993980219301553481806018497760119997543107594
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            19599081070085877602397811941683326835399713190914236314731083164695004377146,
            1067105681915777478495892472818259780518676729996063342224532167804233656269
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            1780729381180285671841769263674498755932780952259318814333518894548332698256,
            15801339467253812602329564596950424447764475451287316736793034051800036898948
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            4240805071164939657115788471392787340333899337057726710962948838251465819998,
            7249904915836172728249720843356511585679467595071689663709977676989453126523
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            1175371894402468981263549114312428715289996510117909111763507491754802057681,
            20116683251061346595406100541437880711842432375916743788543753603811865713206
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            14115125023778431533737121177726521283386685118512614574402453434611293533365,
            2134282569277720047181292069852024359156288627848346661789872430483303910775
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            6548499707228722998665190451310574674145690660317293037774342862736859720403,
            2034728861301364513250238400440546586441609827794261335970759006302749657580
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            11800518647547654743187123885350442425003772301552409723222584384698821012485,
            20786628783637482620965001985411817335708440140406547026559536301295764038892
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            18000148985062927493106478536760508159943320403514365549205786295292306775603,
            2505001846207926443849621579745955499482532137550834120575608438182196726621
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            6412200607402661720856134657747730643050255691746521736493635598396913182987,
            19214550649402985915003059676499998597885000073825664917206932079483232248772
        );                                      
        
        vk.IC[34] = Pairing.G1Point( 
            15932607765962678553885288241847680998762705235462598321394298175123696588651,
            19800192896322269856196282321698384682967703716418763012611664801305455764633
        );                                      
        
        vk.IC[35] = Pairing.G1Point( 
            4626648440982321851189155685689951227690145691194894483704886483460539162649,
            12403756309499488805291744663583015000107937773054567003159016355325552278190
        );                                      
        
        vk.IC[36] = Pairing.G1Point( 
            197627240563968593592396100381555042889790622839139920472695918956077943454,
            20633403429212366113910052425361062596129074894975269260043454359561918444184
        );                                      
        
        vk.IC[37] = Pairing.G1Point( 
            18259462768058195543273269457919444217881139492916669943214288847051417174035,
            2092612117781437687652945283122548419738870144286141755052235340119090587196
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
            uint[37] memory input
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
