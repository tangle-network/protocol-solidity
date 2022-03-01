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
            [12491995128325290704413978934371115731391075735582206302011148218305258104871,
             10224198330218639667475188418477992980278158647171652814381831210102376668355],
            [18378851616396139501644141373777932735773785811203549918101625123015206440390,
             669540104332043086109962640603619738922802208896953058802237583855187994656]
        );
        vk.IC = new Pairing.G1Point[](30);
        
        vk.IC[0] = Pairing.G1Point( 
            10999927999012552059213034855225082129970520724348710590852711521963113363301,
            8501238558899359858834894978588580563111083994249920734546495944703662790123
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
            18488702386542206900367064612003161913098166625251354297005607710602939325388,
            20682177123430498357319710142420386401447821051786473001284070300950658121990
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            11183370025730135364023078370138576455331416933874887232139945048298088345099,
            18617590945499002603925573865796279463737861078821484076133799259827571649016
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            5889333641984740859850651705192652717654478113862935509692626612418435605028,
            6774377523005735592042605986785388376273401387815651142598729677945174737331
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            18588677639906238384524919635794527379587001923831185797792776385216261425302,
            15765517240894927967896689819568946789729690457060022407868113944375433277183
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            6926633299469309329135987736604475129949981108890035618185777938492658776319,
            15176492913692060732807315785998618308832906710332051149020714755951234926084
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            16188031284643478572396990493683944635756911617472938548099205989479680778494,
            12218237161436158014993293932635095867596498900791829186514269334914671658763
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            17732798239004643555640590946223262486107503689406498623745278690082576690263,
            4461699340368171597408491498982373533643986821758780791197942796144409626510
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            8079165170212961019556448443988578950657593562386618163109006604693343406705,
            12401187688500371111427709321606026743008664068245759434718271833689756117700
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            21799504589045142522691277456438346635191687613399017894508875757502030627728,
            11526693313750870386346268877678587829833835989461800055617764682309988666873
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            11278205316728761445432110275082441758735764168838650227275889447273217225328,
            11996221556547808991370206299260687657894924159414885885702461275707591436929
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            19028107906206073380537398181901933629756651563763840356297552073941527219750,
            6908947784391958664563662941824621481420116605071477986941534406156143089775
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            12149753297167478506294743616308463178234095168795524088292898182998235032965,
            19938071035190063168492494431308551624848296368636325242697766248939237695420
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            7785780108213796808166423275895640483525194245085147442487574674767543163178,
            1082103694139617457462912130629087052908435993146792975965675147973372516621
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            14644130906992197637111168038739761718836984975859874638858792935231218000894,
            7960636417692237206501863070528587401018317794559570106228548671018276095126
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            15873064401088720349556556407738413936258122667016815471683790248317190303768,
            6450114672394442373047688299600862965011824078210889491951407470262539156428
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            17767077385695412904537871812030757920702306987218242775899778357706934155765,
            20417718572946583224652330960743202845231940770005278193466576807716320045311
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            6401136524509454168934361458112154158216109904170199430482607926165692995569,
            17738136865027754108615841837723554580226073655399920756502358834385163174709
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            7006357939591106884244241485228503284421489643254464525696160277338819450302,
            12767848563053338909703403713982063166206833228089529858801032616054015090814
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
