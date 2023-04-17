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
pragma solidity ^0.8.5;
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
            [8908549295165042390758727208075959534680767305366039933772250827884171793263,
             20541620148945379757205735200984212360466829602234250067381923599546156001393],
            [11395539258574349166288307507877226253529304786149791044450876409312069841200,
             4154612041957606045668945020692387654221819622094734745768224794255657819386]
        );
        vk.IC = new Pairing.G1Point[](40);
        
        vk.IC[0] = Pairing.G1Point( 
            21547403701836682938637660492288997074851573303704969903584823488094357987642,
            8392420703337893677427632443613852563548253121888686565298122312457014028715
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            5113691280711341841766961034055726557040731368285093530469573083379208236449,
            21841364285671793320547185140326460207764652495923900433000922106495615757342
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            875315622118583900489939392740665546654281783337513258086207565404248604219,
            17273008733299641932729821252567602920086142230006650441951866336057705286896
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            1048892028332768047694019493890999519905989009867781311204216020343755126955,
            9436158651176061684635811176392232937723941793937459622867903294851525475367
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            4868361194797947436700447653709273034505248987371101674851220294889194231076,
            14019820962424621906064582307403149351854006626841582876865058103799064336169
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            2433173315595899330535285983112783710094302083383017030593571859021218093899,
            2838928073327995636048545956496543619890749591342864821532244456630795415893
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            16421244053838763978169103934610511743009237731349874828812378068489234743303,
            20659101627435075016904155807797761137385815069139943699445893766247548044727
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            21605469707052966321697352959457554361311809446871153822884637335724528086862,
            10705039646279497685135664736189738801611383266934588676769286230946372524472
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            8554791149444727785971735675808493955668475070826400115064950540035327742911,
            4456894109792841332443255303782237881826161445882072293890717382448115730344
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            17135551424260750260544890641288087206462140105263848559608817990051411239243,
            19973692887078260146624724438203152685711066492405253346528531377940981155146
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            7055803575227322248384201139929112313179070106663702417225620746531849814060,
            192015867267058572936034935830362899475978315667854153321954725359198502374
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            4171726749700027930499374498503376555829435671950054802139806244895625606057,
            20041455381153724225220323976259691428513670721239803203854692136363116568515
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            9865717990311420561212119008102199189758614555665306002071952624606299561076,
            14698046205052702164578357125674369983181911861383060011226567179276166556246
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            10099578406516031701695436998591420061818914948725219022181234049066248090384,
            14465991655752012381182687138422216583040401760306941836350768937208896823041
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            17572913452158552960224730343814798858014842872716023078677665970219746177670,
            7163162544575020227372839787402248838118555992822408592708657027215614442616
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            15047625844997145635511268200415434857887262518476866358936981870640342841952,
            16303340964973014953005300309018025598292827867632736710090319110534794019516
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            15055729553569999583700787596753634668107823531396750980855555965786450301898,
            1972092759047161330942025336721236241547595424638150185163594739489471748340
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            21667610232090381526657208302100434233258599612865478725031919826423853446006,
            7922474792052995216466516140435310057186915849318759944215697007428749560676
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            14345578938490259816575181738184564469680897571898772264174009320443879616224,
            20355440783079170475713730959702929771143558342005654432584049937500606278902
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            10705934978824977319638775423685526149828739744660233748957008945842572779826,
            20378718465290635480379492173406186457184295109329846936469776326143026478813
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            5475252443899564633914463081502778335983543464565865152037297527605539045116,
            5489286072222439510082274243676318398702210339816331781984679166335927194360
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            20708974148488903928613872122166460854114855391957630416276612117108557307923,
            16388399608631614945139035771389658336421980984653360931753710492379882471821
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            14151088615031031153557331513164360759955550545917830886503338775965626977754,
            3372704572974900704178545884683510802488774071761687675249827176131018647028
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            10584000324026131392481837586903196672813943482954085956448697388643304752054,
            12686981916322576243548803113268214783998262939261929610282340871229798968517
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            9291723034981237912597886127084554189096581886777859551420043130722212109819,
            14882630680104597897789917056248510251343173871360203141582939341016856285881
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            17188019500668983727431024839240424457257157792887090017155367798745172680182,
            21833898077154009733816555055974274514418703428313757559257839945469135476086
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            21240651268633189257262539349038733852265559869836462784675125806298074875382,
            3441349561715849835300792591701870466357167494416689647624326846234490369081
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            13843331958747253498784858719001121573903812484351162988312702137377271932253,
            4802220323785182355149891201076284838125748945377317950189342454977523069905
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            9247970161936029626164941712784575991895065916510363630410902237867259813815,
            6266830452209914229545114636833890161798377804672935010077737099417090438348
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            13720596615852263960775607305891285299702899050688117037453381290778647520507,
            7296482611025842130545961062452062964182353172995977996096240360869735380552
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            16211048655160345265474074052785429106255086353393746021558087685583553566400,
            16961899445622258996966164830261465143418600200425175992977923158482277095762
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            13994540064537635971962827693673486226962307672270627118760732856131078378102,
            1918071051349119763854962884306554410989345366635234378473821311148766818773
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            1214052418660364917080694189686040456219118028917759865501746973695072909046,
            19504161561599066560897879432134135665779337255417360412054830537759908681140
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            10529816446824006608320995701951919848803628162497445322490345147621587084886,
            6382285863495099872826058790505851832902223238862776728287684050313621835217
        );                                      
        
        vk.IC[34] = Pairing.G1Point( 
            2862203594198114819214802503766230133033092862969550031219219037580766969114,
            4832697861967763616027153812665157846872918214856821553599558425177416042694
        );                                      
        
        vk.IC[35] = Pairing.G1Point( 
            3695390050676136704399058570182221694429030810090433763754755436273123945237,
            16281346341156851474788737068504171411736950198235720670979314700290955121136
        );                                      
        
        vk.IC[36] = Pairing.G1Point( 
            12474365083161580340630538050836473784427947125659361096030239340385447621312,
            4132092744382566934248782449238433107374973466628592107561922886932822486755
        );                                      
        
        vk.IC[37] = Pairing.G1Point( 
            14342823696358350974860050988402025562464567492260079765634901080074543677792,
            10281710671522201732797443977180790698056429715653008371600658001114903392507
        );                                      
        
        vk.IC[38] = Pairing.G1Point( 
            18395876856874220766605462846922878171510762621072932424600481007656120798663,
            3121313235646966324415962863397617878035862519552772123334647330955099924261
        );                                      
        
        vk.IC[39] = Pairing.G1Point( 
            10252699216976778340155245942548829224401036092799632385960577358974905780331,
            14503915476257319367483217401395429749612649399452742076101557193033471797163
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
            uint[39] memory input
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
