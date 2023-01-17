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
contract Verifier2_2 {
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
            [818319436928213335881518321868061624136032127908425955046153581130689823211,
             7301796100944285196472653767894974933226957433629946823948897925081532775061],
            [15794476266377564306558416312547313264306481086211796835308496701209738427813,
             19693537536651670757785009324093067646375277649351822885885064777082106024973]
        );
        vk.IC = new Pairing.G1Point[](34);
        
        vk.IC[0] = Pairing.G1Point( 
            6215685342447121870000363268490114758258804659317855985831523430971412862494,
            21562829765122944432634162228865603503117176047129298333236731636596203030536
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            14432199998458803458841410982039248984064740326422852687120411861311366110214,
            10523334144178786301300462093318092906919724600691193117530258132570216622348
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            21519944632547877705434848392231467422581558589015030899982897926804301705296,
            16203022685014321688270220465031738933704083677536969132031629728195772095851
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            14024151359069507775369362902663975917605610122119428539544820594697756008464,
            2230759689836783157552134965653965321211321991703111929574443362563438678025
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            593070814919122561250331587371396613936337872726682729157156101935361160361,
            7461161240927856886940121859319166214404643705576851921454015314494512589054
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            4966088809917770893346853827201969904568166881945235628602375970767712852857,
            4039273836834934362802056515405434644490269630626596839136046440734092162366
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            1878944217631225975822062813867038304218182774380683824599795487311978206242,
            17837008387645599446520440250921807841675813095927856250671855927090156603096
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            734966140075616081937277014803925953228605214429667275378045188179738998285,
            17999251649575817164590208192214441640776634591062288118589684838594145983711
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            10676574003453801958809658323548283616644026617940653138259364814190643681969,
            1301749087580678109680019047667739334851827144443046861849404397196126802119
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            91736104476624147106005460290255134028205961296449022414017343139329613172,
            12002114638650960257580580822344934898182377787652836458930106097615401864930
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            16416100847370965215432507565636158999631986097771616804984845481599392998065,
            190957279382991862586719358435029092093109021234442808066502160423294889168
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            14833644492728352967916051472446610934053986351789242988739890512588625529174,
            13200397287535143632991984725686960767553057490599191693331315660105981452053
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            18297280203750072904835968713474827258796855758255380981656251213032310332953,
            242912320572299176752383433703204836378106851790766802536543001936992865285
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            17988902952054131040598976118790085615745063801765929451954814138779433090034,
            17891268877504133775998196133583368384243212897638883690660645503707194836193
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            8843652467323526637268118165924316568923594930983120293083307175682859050540,
            19285150444016521436238132637925655795806695494737823400804985245705464972818
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            20654279784073741451424593058720444753101806994949234500539243667295149249140,
            1052043261365317015254615760528040169504897079630227274232770313153492738091
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            1715539390010602294285662236668440649132258972966097895159493469783168871880,
            13593937843851272966168461701854369478587751713018862154086326050351431875949
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            8487261827837485710390197558021803241218153856794387014985936456788045831120,
            4144763081640304685077803828313901731105849315632804110837341294784650940044
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            10947765256516844460321394625871619769311632001837869347060695050319815322647,
            21835123843774862900855883495140442331311126799589815190766953383056772266271
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            678867107843970310466282477191427027388540454824045728931178001702802940673,
            10132371716101413399530890379246826259389246702234083397136350407546356410135
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            21527012728349351598100834647666761427781658794994552966198536718775144866451,
            17790016758859683410301850411018523044862532762510581260315720259719227297255
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            10950051053345867274548485379108729875298306726382465670665434259164317066112,
            3160229502967613650466123641145107062916595959583147687233965214260047474156
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            9640413005506495872050892651103403013077812815718318849128164693942839032761,
            21558299396843423864384802275021827086513637573236970938344847543721347182371
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            11614980690788232110590188623754762964107435959735716362863694199830700309436,
            17962817970659273502654478797818924781588493273579163727849583747844062257697
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            19642966313110306100896049822500852548572827877296678957423590994977594666681,
            13110265470939851482271551098382736839682551835979922653486590497436335925608
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            21462030086821557081295317029839674143082927772040207779488402249165223416434,
            8330450843705004275930319362945546575852032040862829956084372786236754379547
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            2503320907103358639237562418091995342950608722492527847521934370279898917018,
            12897259344936421779300213062988739811704219394282475879809332263862073476896
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            7695685450825827609709329090866228842476625119642015815562023190459417501931,
            7343774615958778379089902019832192427514952959531011958605107661561429799906
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            21069886338936037005977299111641216924726835892856854982833373450042757017796,
            5443779847238124604339039952019702223378850661029569856658706465521559101264
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            14427200888055978819212743993691338200220459570789037788990374871801510068617,
            2537493186612700130176608574920780729830531887899036076149471856869719323426
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            2736531358867479413458163054666416662056356501139831406952749842959380281462,
            2016927679812054281672628564107784264940001726689883308112463110618529821356
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            1856217845204118643939355387284095463736018285633157212147349522725099966014,
            9650357086827197051528105507592374296281895724224680302931428034312413110427
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            10092255449256528236543976446229389175353989043158231654465843536152316205337,
            1960594064870492263324647705631471281534307573834669798521920541962711774252
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            5890333821748916479317635880108458551129491231213918878728111627616342251756,
            1651568513842243172563944863818536498384590605272102816600441882609724586362
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
