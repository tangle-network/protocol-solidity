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
            [13138734580481428910673948826375194400161702076530970966951163953540501400375,
             7131510119826332652292988828828384494555082875868317938618269211463489287654],
            [1103276472759156692945693701090233431325569283941609969457528576660591421872,
             3145172640484048708610309438352385599660032557104118886203034316380612242014]
        );
        vk.IC = new Pairing.G1Point[](37);
        
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
            16101304423281166315319764196452076996091506384575013113047077344877695593198,
            13788427417772336927248249994632110699460793749474648716290470259478627781800
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            5454006409744732477771299046224333291112604427382027016881972567511308144469,
            21738458343341280327929324086510140248157522286687880253159224164593925176759
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            3184570953133280230738595614705642747611083545292150270354832426906533345175,
            15476393968194306981602748828707892228444018079904054672680245260531671027050
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            1699947919972583176947695986760107582352161968436219275814332918655033158743,
            10140224338788881858423586076485550145103982381014758623654430084812598104767
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            16655281918188416654930096616479024186226711409192430566663933114475169376917,
            18555788895062646314632383499248302926387002841158225159197450012393781046291
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            14787600926901857947972991444828319999923496122136981314767146626930450253540,
            5632864187147066502634587381354650628168369008692250112431635135034739281944
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            13617830316763827438702969018742476655384080840117163958985465376205991490437,
            2724392698325912399636814632141322693683776410822481305660293533610394469047
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            19522978665074334371778649147742526141742931820078765982559265756001107956696,
            6295792837951756580415052386727664100449599329878581558081090083412397682619
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            11200984681336285999679834464963737566039770922467198819364628776883087968751,
            12648960174534023726366034127283360531871276542398830321786157092428453493221
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            8636376458380288630441590140155227413289110661919323682932335256108563931328,
            19485424197129066481249408393805715807112158622097128575399322226104739165451
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            20959965730061295828470035849264091051833741511718120501985105989952682132031,
            19321138673450060658852452394284662865049953924653298410077813991140497656622
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            852078887677674324460014412120485264810860483381820215593292668375051387507,
            17226202898418464784601446421294683666287554413716413242420539039112843155160
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            1056044870587472039087244015195904330800298989654279767536137593582594989943,
            13928545670659089573776348730511281774465096043073833790451811830659612711216
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            11615293128630752602581477726792700044183161043656334351799790841387254457097,
            14577069130948038482563401873148411177510305190829126252316836390325537013323
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            981646857614764668148162672108261284879182324040458310124786419761241242758,
            14888599985927790630210512500932545699203154446647159685619178051897109845233
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            16877664720617249421195322590195649073533764253749201558789485532120420350869,
            432967794501071036795673123428746968316004209919435476053962769432572123633
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            3352870371870046010575451761640304114716479798700388187699565412485447563356,
            4262943075492671274940853806610087615686182730698902674788488933477884747315
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            4413750576840980308926446846239309167636161430020430114011777952842114314584,
            20564076109892932922379536103366613800661679147113802386895111710409078583212
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            13481997826941594987996172246485802499533257372963974759478845228953691116701,
            2437238893914895420683596567743362712126982890038224530892778686043768876061
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            17950965017263080695585176300291428797422300499788933226436278869454337223353,
            18874189594652323017048266080877537196033836128061768595742227478412342811770
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            6411109484410489405012419344952923479750230249702975785058230406250501227466,
            9949818676012542495860152420189903434164409062241756109964136120387888508714
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            17779587857005150175485313309054495974422527258837018334123449426314323065127,
            12310591989643318095333819001760228550921422784718924769836558056670305628868
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            10758821203866201149486032027481434611478712076229581448213310076915273256752,
            10682202715281831975653859273271707472576856764380687300927502421112755043662
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            13006946914322906763357360969430690470096773967857687445134889033558819224117,
            18093846368143608123813862641712239151960669729141082877940500883479636718577
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            6657113731612881702827892114898763368252774105214895426137945159293282826019,
            20068353074017419857625671824415599977234270972723679352268165309105350866152
        );                                      
        
        vk.IC[34] = Pairing.G1Point( 
            4525821819961705852339706534524549639344784200652670954866653464454738473618,
            14054834677379537802561345622072631457152542501560452896494328660090936941386
        );                                      
        
        vk.IC[35] = Pairing.G1Point( 
            9008778153217527302845935876170367987474223848011849826680239632740962667458,
            17466062390363892543249395535432982007682076759473801474157289039970779294299
        );                                      
        
        vk.IC[36] = Pairing.G1Point( 
            4017671149419607455138364450785130295500217921673216487989296606384630313371,
            6138073560712935481696308515656945823028974673410507459101578891877662164434
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
