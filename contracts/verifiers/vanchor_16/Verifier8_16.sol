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
            10272469809358981458841146925949286277332832878405148683907553054306507240823,
            4430102740047049768295896783646187499556023753025141076833455021106945518127
        );

        vk.beta2 = Pairing.G2Point(
            [21210232444881244441683359804539600637526043731793144272967405631097365150883,
             15551640728051401802607496549057166788396530903419071830229399307217826688796],
            [8970131327600365432579311869981144184402598874897048547954264197318388149176,
             13576016604205012226028036761630605413635482115296000614100436825385545362371]
        );
        vk.gamma2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = Pairing.G2Point(
            [4846906097928084887317841886914010709224118019718262226838619741265747384868,
             13866780657861843918685933850687321845469446351050074293119488424209553004463],
            [3007206238195540579862528858236315278457019600510433499901714906800333229768,
             13498235649814405800902749374207977313251894850476724550084645866575739676282]
        );
        vk.IC = new Pairing.G1Point[](30);
        
        vk.IC[0] = Pairing.G1Point( 
            14493962305325674700177536802789343184821886024423508540604597831739765589160,
            19829295379727604043873364237205911546548214552453207799595340408376631093321
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            19316880385754346335155629581956589724332134134371565352421606204356300553261,
            15945361213555716008991373066685298430530632581902701611640254444299786087197
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            8907443816960553154090247521188285602474492303908417382675482432171090778594,
            5246578509501152950370134105591937592468605732146481623864620657427938441883
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            14013537087919203098931810096784050284010225312370744869977805766343797307842,
            5315894327194651643162612255182738779656465692540147425165594684073831277046
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            1197217852943459042046302275412157114728702165380771288883276173430528729470,
            5708264964580393525757431085688743393563660574743106428311492419658151083273
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            8897454845442673697087821834424199357607007377551899279172553494567073924842,
            15841490877589847355210484257841603388662400603058689183332992015806904702704
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            13090798348858750712224504048887991870438249248618181706276308279571305512099,
            16150561405606306802861140037865914846899502658505356904115884775992783742631
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            17703644842725558216928937324886364179361626899449857190488737148258802632816,
            20485496581226091487235614119657027608245646050153379295690161359054245887580
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            16625715496899182416702158449497957490155125038578636672896146311493803192305,
            18993159993791521061166122655985594920606234535449146591725632846410034993993
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            10390979830669632529851489034936152095968732245503393745673018156117202286099,
            4338072410769166066982051252687660548006089116235694257178055075836489964343
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            6937119058469816195329074145021354784806675363755343360573658225761718417784,
            14815412436200268454257142606820387994694342256201176819935374679665478772925
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            2442674809339307737806878127208350811741711999719557135993573149032270874360,
            14336498321909885644976942386572228061494891710405067715972123226008188491878
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            2426917079910859004783416168555153858741307048179452681706847576445583193160,
            13113977712158981276124824799343274684919010965327851224417921200281719887919
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            17837913020902560594836689314083639125075920635083201896491778875576128692505,
            18874561603814869221209809558098801165929561141678195064390941485047611581653
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            17177710067079947457588638936975939710933205744997240053843492607331534264484,
            16910450018853694135547800953803534155799020853858945842553807645565709735721
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            5883913476303650315647734672556914069788038679819144082639427613979866084228,
            1170674773466259401893158023235090727334447560390224017182948024106278959700
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            14843657847907696995514517868618999306812465443985798278837968680167966043851,
            20425076787075931888821217786004012527481429948650643420580921725695508166651
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            15326446502384974049162967493301799506499933427370562297055764192528420556870,
            11326474617839724874223110407628664936279049140900418615048298375350840238801
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            5110545140390304498467197379157222866052895677962342898888170031525412838685,
            14086698216702639452760708183079499583845782669049246146376422525903221919322
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            20329552598894267022944558303573731924135936655679304767466834636266580442272,
            13443325371946066076508374872509222320116939736665502208649145093733926675155
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            5737832178525673097753539767027034471071269721154925472373482326286212562404,
            5981529981034549369460103745038299785582166687791750784269248862167495166201
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            10740978355766869376299683676959269201143175503237270807446453645806906674473,
            19128367839659746276340327875138669916961172372202087314835252048113784691895
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            8859160418616216697278539521781287586503904254971014185974183015231984574359,
            2700207920203981129621562600453810891825277855744774745873154888248845165644
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            9392637787184103065937193831255933752024655680611411961672742051014963229957,
            7966088269980589292537760665793283878699536156954894682095446410396731639339
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            6837285653946769980826104032909033695206263196970592006808176744477267688040,
            11416037507937657547730304678090890955681644349608656101779438733513914547199
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            14165888449388066807297826828843387931535422680478669435998824335275547981315,
            13307942964576029701497388769923938148015087858138176064664588117951045679426
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            2297949423621169296482399146755148335190711842747299579359321211417238693233,
            4554027273561942206214106575905633378412736680533127206007016802124312025515
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            3615200945515847547480962726943866186875433997329216763030674080805174459256,
            14140580228258224928603092707003921195757786718016466331834573857461802737279
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            18305216001937814712253587629118050506562578974172933462810069979141444111132,
            4445374104063536824798129085304697071564564556404569096041137244140116013043
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            4799193630572549833738057181432924466706185877993251102566441334471212975855,
            15353364162649099850071862144490945158841870204282387878046821055330328370948
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
