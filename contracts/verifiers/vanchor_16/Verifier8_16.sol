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
            [20065442241188300601273957288950425666381387250339037653888181305152308786925,
             4791280076170425655468312991790457848945485792329308995561611935577735176554],
            [5059475302201594161300686497079867490931617115384942115857300905036316993864,
             12892377489953472215326301547715873526093781673371893373801514890212644026190]
        );
        vk.IC = new Pairing.G1Point[](30);
        
        vk.IC[0] = Pairing.G1Point( 
            16179715987781691718341314012006052130917090585207074351217752313535820211956,
            5431896750587880960623297942063593529096009936334320840522731890724146020447
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            2648360086885320534934285227337009726124812943345035165853110048199020489597,
            21693708920364101368547066932372097290633321849220744491020589905553831877952
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            1520364506383744117451866099051004196930138008651042121394781286761987911627,
            17932963989232221352090177204055400146373390094557406960028596240514571494055
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            11536280521546953570221901351224254662941851820972607335635050363029709778002,
            20984978271052175440567365757254961811739067484933739803469873685610541324671
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            20816267015252825636772367446448395158740330654401091954711103061182010607250,
            20802462399202039788592246903327647930051674749985684900296894227189348370733
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            2717813493052481045014056902614299050231628440258491865681122603694013021339,
            9736187542039009146624892672334493049483939257712476488484789346653574382708
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            14161570898373530278560250807108667504202418051106998587012091488509865064764,
            16189386413066600741173703438642447488034200428492535792191875544708127350923
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            12407668541294506131253330941926501116456975183099933509352596882554525945701,
            13859534168660834515534532733237989127527327589206954909736835890340774955726
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            460320002044922647072203723680638714642773484825283830417803050113657066339,
            12641121332198076846796198240424207615869306940571823609394424998317535674442
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            9487671034523101404403961827803548395272603468696173003098434949448647790498,
            3547435977146058461668168659055129794400273596150601147421303256071296215755
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            16516834121966624110363349805398825296234771166536365470495015625740778920395,
            5582819916849754099614170820526510281335630066460943971265028785242615678678
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            8323603224521079665644322336579880656437389761317120714870021468614026114055,
            14995218685460247415558723942506245491353583181637381774688033629148777914829
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            7441630442785163123786192388734415589670026656969018268084490606874184156057,
            19621285258467930147623056092895564222673660089083248125697167724644206738735
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            2947050892250892643272836540647486737220977982002220226068760996560712145836,
            3402866434284865833482312057381231224325525255125838593825895013480864945910
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            14903088059342812356141726772519329098353446263751987117479101550514727025575,
            9142060159617392654430835704358176774556415734721209302509523530434658340337
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            10697232720922370237017827421768707741122802159584358005132480475540698367808,
            21841318938739021086568535481559375140159355023383630107248112005764116549580
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            5780907524650334257781306960727856777657637475045695387650695817857864376880,
            20061814884042009972441702683968816131260721526928615818288689017555522979285
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            3064752112679549129134322138049922729650884076576256291137972935005934269829,
            4891092334809702061114878358363988995676279555737777198448262516106343785268
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            18719713739755340557884155976065544324742955647446851244982760882133334888666,
            12584343331895585262876142960838546851228878975903886528480321855258965052688
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            9482240433101507958377745582002496336862647401939276531693531917551662649400,
            17340458201499248428404178221268888203350797786364686351726115574777580789401
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            19149828955779191751941585807780705004407666080425117833315064459163953223878,
            15335369928959115323441718508828584764572010997969275509147670261990539588980
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            11065181128310449832737803930146878918872892276330516295007235102941993623182,
            19473312017446366949543599388070525057138470459961370016705071488197835134148
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            11884315147945076138883070912808940433864764100959472183077959662370131376089,
            3595025710483052685552118883285463655156500907990425768478130839063005961739
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            3612135683766164460651029639259762096686418874167262680375636433853465189593,
            13249384196730344297732641949505178777494993469505703044583308316728803538321
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            21099319565664381782769256032117683084433521217688271907835945412205949446745,
            8750842688295019730035605091310359453481498931415703346950040814028097885497
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            13315019571116916795797828348313703993993293225164684854209146299449273880072,
            6449924966327042735286940417395010418129736657683767721956897834395513056891
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            9673166232487210104477870177681269563297430308074966417500048625776260472298,
            17934354016102865380174762594650581994807741372283830439041985057583336383161
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            4716378707066257837070970773491747087056161677061767370002787328226984350117,
            8226598772909292466425145088998909347649683078592981592119307537517511571050
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            3625085243685389762368191501811289622491090581789885341546851281076993603226,
            4637228057201074401576508110633553279876900519396896070775552852968970297484
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            11438820629413697357716185537448209371812301751349007810198704361162910459177,
            14504212140203509065081377384104431774021136830128340281275229847035270611615
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
