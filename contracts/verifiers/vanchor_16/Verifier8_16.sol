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
            [1824692718863026081342224675892478787933440460877277199356785712708317187544,
             6334158753223618168360814054728516704776082369736905549529312299468536615758],
            [11478912891606045451177302580609928578576989226501506995794473635905249348464,
             10052010833786018141878303349072113120693953013390055622808638353176190772570]
        );
        vk.IC = new Pairing.G1Point[](30);
        
        vk.IC[0] = Pairing.G1Point( 
            14032280905044169167183273064633413567918875109598526690112284737955428105078,
            456394327707339665925602512960047186955892717550786266288515956782498872934
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            7138109376796621918997324730849904939665022234989851700127885702944495117205,
            4034800894153691928581906174246120929793800396557800571423581979884796336258
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            3905535428270374711345299035409796187708140171607321989489366797288986090946,
            3911032818993592636744470659607240145454924511204447841685823292285330445874
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            12369838723852544712256219469781568029284237025641139367182461543528283934764,
            12599229179078481601507458170485234875176856997480355386228716057743349825412
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            20104976189508684990868083983307085212912123056615301324327737082991377549301,
            15744581055556734528729486224562395701985489228491435490040579846703022788892
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            10064817172172030595480797455623377720251797385613132457667218191834486186813,
            18979599991898707697518819847057451102343506518711688046917998956397707397433
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            14679628453684680989621858604773614443232074863020771683778126293787944659907,
            12978371080796468700627950445022317772041450296082538188028604053633216337497
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            8171217806019615256578345833153580168871186688769471329577617338947347806367,
            20493071234641789265445800956532822290059924910228451833979574567915978673597
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            14170186725521877016563612577604211339592595700982204696970935567717397790034,
            4903412623718647799403177013338253073871454056487843981971638532668899018755
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            17167171935529908386372731614718648853459622387699564667146721350409464384352,
            16354325941482764271396306149803629657250739583195585163988105009600555723570
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            6790207301414266676894784367165882524142301438943031490588606170678942662142,
            9499393823272643098134434821282698037666110231576620729769469875503359911366
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            4636748394467533200841581595839315743067829285199998123487049305911175868228,
            8963348521526972871912079329580507663844458499129161086623942116721421372431
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            12396569765117376949705984313398072710807131358162732957429979894927713436780,
            9088773521813177331832387655079525491779022822276991093612550389710667429368
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            14312111192212894128037947745706454993659393207592227815619639517904695847180,
            11864807813996919973499903807997851351330475393931659041620741819333729161750
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            605360542233440351422257204141691337603538048384635828224682248612938380950,
            12710878145874129756532355964832782633360914129714603034298072171526567348636
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            16331677895583080596253720445180581822101220546152139100984681589067325082323,
            20945339973378603725783920216834318344725024382399429241891008965460982924539
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            569725913939189166493249165895496862558945479881240822376998212967765557291,
            1312874826487539157654832394882386182929117204272427588824682194154678747006
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            5015567974299816405517454556045548072580130645020284538714465104807744134779,
            10863694443445343322771621435280503388248341760430074562216810104414555119966
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            2149089588950219768374820573861396576740629204920209221453288054065130899469,
            14428162914444867715853764745912059907394069291234974940832003602864012653745
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            14052051335777269052585339086325299611537476920216381943970277125376421025519,
            3302539664121238032104254142647254185615975437892993712986523467501722360213
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            15992973503890431548072101543440914575187502977824383568358012706489974978244,
            16967085605723966095348674535883596354157766125439741460145539011175059377943
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            19662318083992624656572809139754078957204103656298494712655324060222616270933,
            14741134427043999107553521829425548313900970410815190090668318574125066157608
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            20899370352306597654467643808363496748903548412606709215727948223162623952479,
            14050488824146994092727215930121211784153509456371551221634846412653234190671
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            5005232153616118402318949855895773515583622514061163810083408449405179319506,
            2540120259641973845312052299668768968768651065115447219392544117527328212176
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            4153578871257162244875634602984802891111934479477683017559811027834714120164,
            3315192154719827886668424887761777886956063062423167174205570546345178400149
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            5187814531066783617910094772296149575961332104036911796344535844571350569862,
            19789009211863950984194550411770817811686633758622825286196016277005444581697
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            559011177618561926451689463756854807563033209868808641733095312923332795074,
            19932415304547230109698927126625649780342290982441125911972723858376979806690
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            19996463259221004285369768036972794395638208176564023599506243929091097824106,
            14439693452805880800822979136812292880780175444001181373111816907316837244361
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            7952884908439453223592119714519912050414202239341561786501125197399649874646,
            14731206399986580889861818642761412691646034239134841886564668230913749048054
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            20327872617365109439885763469961255260588113774704487118064548874400667525004,
            21798565286913895539075062675540686229239671553202486623391309896035434601806
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
