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
contract VerifierMASP8_16 {
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
            [8710232119088437905010852900617883109175372474394759430567484934566726209966,
             126834749051582289512160665201393755895030060165341265572087690928718503961],
            [10511000607130144884973318924518453952281043712241647691385263032703378061547,
             2796685690133967163536989808562136090604290360189632860894704856936231784242]
        );
        vk.IC = new Pairing.G1Point[](46);
        
        vk.IC[0] = Pairing.G1Point( 
            153018814932304878037792851447708205783939456415350152796788264265700262830,
            10974938179630702211151209229115750942659303183626959936454973647629019542900
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            20123980210408694675976750117535412193122710649040176655828942164795846828651,
            8910157656514263225729846079765492900487522503114943707664672185064854410777
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            18184731363325051915631095209118020422846776662539613426715329263737331474988,
            9817571893926526183482650321180915034143405041270385720890605950864048596483
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            14715746525005844996656812117275367520497317569699360697709300264921130234968,
            20682731277406115804629256122770433001190912413638078280279914540949506590278
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            6223161248927338702260535002066577336346675299247671816233789978138189613724,
            1942083225826671481836548230200758563542377624616262098127075138892131375382
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            12332901381876444854254899046961219048195640036004732074214931335493875234851,
            6190287605907075303417825995810376374804094076289576600822970571557929270681
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            15012936168745038146831159464645590552295123591418557654672124484282641783767,
            9428458043153867599715097719269789497942010590694507159779437015644476339285
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            17640114163324436673789316378993425015841017147794577866225276098187183324459,
            3978385879800037838646942912107414137160214672171399653694187328337024178334
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            6788122974851459504897869366780200540765495823818075095194581172743102191012,
            292021759867756557879698287083937720852906108623604879782276280163634946580
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            19020511152790777641473719596776214949499055976539533575050681277975487044611,
            11987759588738865055677153650793301601812908626764898678780208454959590851361
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            18388597574384107866171163512652191141086020425411526180323475476916343524308,
            13541537752279412692118431292124138242422494418859036192278143075948174925445
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            13748846103425636369666035558681763593050464737813024571125220747408504090371,
            9069645241566434657221435730186055300217436553885941971881201302057031053751
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            18072648155342822715989817598169395627778163887760216806983833935992715273061,
            9980517089616050745606080992483008048191722925321134824865116590296282372044
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            5111249952032189231415563578300239666180836743783575356965230278542545806579,
            21653179901313680407342605279844396444530681082892479433411283741547309366669
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            21162609359576128425914506184706932429742399148884051503618911429806160570015,
            13246116516088149575490462324983903736363290016940705603692088189437140892612
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            17427798100514499568145285775627973419895542085837236271370032845390988515665,
            7569593334641464072827550851629984777724433786386143587020288352658314831246
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            10012756814455055865461452539973019467976185106124443964362077559434433752768,
            12991667660871904203201879770861812928193736001013710911231661577868736032084
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            14452496343956780705435721679808889626511665720477258411389683260765519303351,
            9347537193148147412384561206227173984676808251990847343550010483244933232433
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            18803291914390160349916589925685183572414964679808637426302880614165304206813,
            7570574848657211220897290587071516557507542110538630219635532605436712706741
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            16407065915606441399156244333914395146813444450058122738566807126018485818429,
            12668858537395156853125826042567866523988889329109452076748775448780975217834
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            7568772941574414611016654336023392501738856527467285004493290088128280652824,
            18863946079832130152406297648362065288908893673528896282467782963041975025560
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            17116818723756701012442463310173292470036643307659949728290703219334751673688,
            6557015212807437521589067558880522186297155416746087386033725916081335622236
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            4663192429963297531551802716879980424041357600143915025333616404972599121784,
            3102503397474704321694258353942540192227548944581417348517815634011273220564
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            19374492334956330096504649268349145460161630324191377995442640759835631234008,
            2210905084276068828990221318196431387537726978953247907763580703126935496597
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            7580080521943760886858675599041660572140722699004155643023718646556318095121,
            7121810602196532755145311901954294926692090648940930736425028417740025248585
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            13529765965808928833912913295754073772054789062160708767857785736385481591532,
            3836825977401042794892385152867469519992496211329119409911679938406891767554
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            6352973384054406257125982922380787980098699696821828874338604680677588274197,
            16766564190634012421670128391928256926115736050551753947112872326441788096889
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            20448495723251161991395193799776194871151670050821965697821225458505708705997,
            14105856098821708376240488285304951877022155053491890139005058734730197270953
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            14279565994275616238884211378134458109180769694829005658211112872286464730868,
            10469170300530687092489798630739073806359228215548373763965961900478961894050
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            10525308508912521052687938707455459834143666417858891403571228007660097467684,
            17051748735560905814911498717363498948642716617759129677896116653382640500402
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            2575180812180979621799216252958847763073441550911623045802396887845508421733,
            4187216533152508170880925103944091012049365042700755633119588159794039020177
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            21789485364915594798970951269825647521730058590162661381714374279171547860412,
            19624727678212737540721291552987240912469487376091781849962350537815696165594
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            6468716631776103694088073304644746543915960969520492297999650291351789450327,
            760551733648704026648848622775394332397394308170672421329612837290685397994
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            13436589315463492507907123320636048932966616988617836769712126490087922177422,
            20159006089229907324385042656411998620025373058061782330528881528833657054204
        );                                      
        
        vk.IC[34] = Pairing.G1Point( 
            7137400991509256385396728332740613818891368284323757688353380035961801825924,
            17573774720048017792322255502853314588298113647025812726827526845410276595502
        );                                      
        
        vk.IC[35] = Pairing.G1Point( 
            3310640675907220073090709727180639563593767302275490422129536963696344068870,
            6558549569441671104726083974007755290491234672439424529248156196805285685803
        );                                      
        
        vk.IC[36] = Pairing.G1Point( 
            17997156749831236812833236098607648413601876610499832708733029118589325643943,
            7621061446461447289687208809020733463795564656360104160920113422928044115336
        );                                      
        
        vk.IC[37] = Pairing.G1Point( 
            6029912712620134258413818553921940417834278023568706298384988695709521779840,
            3138900019769640165155035163939000663119427011823887161698272231654556821270
        );                                      
        
        vk.IC[38] = Pairing.G1Point( 
            14942180682965555616443202142799191768316533896532853133970691277633896694624,
            15849380895986706744646154243236673409553043424035850065740096474638360864223
        );                                      
        
        vk.IC[39] = Pairing.G1Point( 
            2608580150850175371077536745906765154202682490800916323947948515442009246981,
            21615389159380052483535978352953800191710784429158317317473798856818413929688
        );                                      
        
        vk.IC[40] = Pairing.G1Point( 
            19112352582587833778048644497672821722457065768627281230020105260849178553160,
            14866377255425266202759356843009343237892871588591047220972320180482393442624
        );                                      
        
        vk.IC[41] = Pairing.G1Point( 
            16678632246097112516308041893416310887333094753925357819188990283845124516583,
            8594439471930523483960501797787291202832271576596436793477382164261861845262
        );                                      
        
        vk.IC[42] = Pairing.G1Point( 
            15394452082979757840761594970230939268686532984750003273885007504554896107940,
            11434313976208083979005390040760836915780508984304273832503169751973431545874
        );                                      
        
        vk.IC[43] = Pairing.G1Point( 
            2941496187913612848508646525858932862990275640037072621190593528053485154247,
            4715287757755874422512392944123546624626502490256194382306521569878360067243
        );                                      
        
        vk.IC[44] = Pairing.G1Point( 
            10580765457199066445503116847833638008728517682325836390084771230790325788402,
            14063239274391811881175242063733488477865157671106491893058878590214106650476
        );                                      
        
        vk.IC[45] = Pairing.G1Point( 
            18051806010947073201915714011358475870139335116001941380162583929301074995557,
            4030810423297719332081936486107786193151930476531915371427651955964561638854
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
            uint[45] memory input
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
