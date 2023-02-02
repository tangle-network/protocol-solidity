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
contract VerifierMASP2_2 {
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
            [7089285500514455134150673258171554303228629054883219477588235759621912238947,
             6261688819727525616171596358007551277036403077820602831168088963470551434610],
            [9665504286557227832037173599900866350380186857075039581259475859731535047952,
             14594399842938928144028380443100817019598444860556957726623954017707204748693]
        );
        vk.IC = new Pairing.G1Point[](34);
        
        vk.IC[0] = Pairing.G1Point( 
            8502881420628078144566856882754737190784525350449125197252377943554789512346,
            11072753606019734726845124116633018323116817074423109279444330446988209096320
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            21329173007845087397441687652326474398597722524777155699870346745539287945381,
            18335964310943262953120449858281694015617418035481417194981889929828982573034
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            10237647274463790530792990779021775637190680390748155087779302456272252592907,
            21665779310448518078974288559441427762369933399421971180727210905107087563282
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            20184382050526289791319338258182460291150657552832134545569796480941180960155,
            1833947911529895993417230377627857996776267448372993249459178373687114360312
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            17155212755904958270025167342888792917475474585832441007902922971843045320933,
            8837435035661850535161786440093198950110015739361360174576661827655639678087
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            13608513117277647370497872335337415882808573886884923712191716049780376052271,
            12003789813672543661374199443311163570744631550413476680204828882461019055018
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            18268238620814721580614663797331807182301793748419360389195728941526423275551,
            9242304918749179285150217317799394848333302872009790544971598451066398692768
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            12444586511780668491653567170640206087486831424644451851393823912559117927559,
            16133274666547259310991642023182743417754934776381147476582525028178265279310
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            14138259169076362475701416574923547387493994575907373052138523420911416520450,
            11816839047156859103760885437382352224677952895538583590753303849610057835358
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            15881504009436557483155764856488331036335087291545115828655544555753123877817,
            1617922240200662818414847561513460062520447465492552785787870209822401348643
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            6655682387382511654399895834913526318405183807241693161822177240513325219473,
            15558117441985107994309563130157245300062324896359646300908064981277787595757
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            2496681017844074724440362034524640868891227875939581323830062884539594434398,
            455579653601702585802205898571533517050345931125239808969525786699260139645
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            4542437900263003961937527670691032331712678312263480346761584381421952523049,
            13830727337442414203242440559770731275596811268105590747939131867953431902598
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            17250133889229832735615345303247339064405482542418930255558897454463046857238,
            11773939390008274767034278565426368596609504899888585711704317347140112179097
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            16200615550078122887011819434069560313313620788030792510987819885037230848325,
            18451026006269691830349878935685212693923779135974499772802769305544107978246
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            18042006624070047488974325173098352602144072952972589089065154384151731946511,
            6458959554708783590458023600994075999862012189716552417668963113993964712143
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            10863335495931851001337224709182860247407797100227456005851970739591738152354,
            9001109830803196765308152150071493002122653130906906664622938508861016870049
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            6519377467289791767625978082763492611883899077489851552611552995576052057150,
            7132431234705628852414034420097458483900888156177702561595466198273796611224
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            12611584522902324220289496962323144297047758031748472757367546748949124018357,
            10119292694273217399059037407435124602977369864182463115294905288432731558927
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            12825150732840722211099296372031562471688488633149036180344575958997280065326,
            5765408143850845586879279709228807952858323585534391936934777101293934037283
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            18189854871501700494570033938898316414705699454013754021463993097123107651160,
            9321625966746662377069045940697007409833718508081003065245029518837506313407
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            6804064690897590269247258859623459239241629233919838933679092170628058356085,
            4113150564863889818014819494075351802716152240648270364518523915749162165763
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            13922897853520587879514470155520484408500927927233600452591638690571857630224,
            21415247720953451187138630969742797961281994306692651290264859411562381891889
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            18942330865323260014194883241825768861273458936635604546898735980193801129599,
            5102860563137651336899587932393217448895860488926204538352116820680131555760
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            10787809450229521580165149208782281525427312697152305950903165706254761954902,
            2080746549319165194526104049887492696463754774322049925317552143887388498353
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            6828212733873455159733360800773619141575087030444064606809891354266334728537,
            12808157699050449313228462843260288515429421948337329473139184942190883280961
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            6433429644223137449008611903857704361638941879645853787399889806824045828873,
            6361990686591376277243182256621477642185111507074319879950132378904980051826
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            3041495952691011051825593870589946746009442457647629941966712122148984210047,
            9143301815598448074117694565126173281667917176206253206591861010005773660826
        );                                      
        
        vk.IC[28] = Pairing.G1Point( 
            5936409208822352896433877273239422640725233952647947971977160113383010482503,
            4268673148907357619887948389340978843051501430286303673174755167974763870043
        );                                      
        
        vk.IC[29] = Pairing.G1Point( 
            12342358827425239719794641421857046586793944296907388229656526069178003559357,
            6724216213801310709450865716149034486284702632899830837133037388822769260944
        );                                      
        
        vk.IC[30] = Pairing.G1Point( 
            2070951099866451006470582884731924779924376206936526070721983792627552951977,
            12939198784256065543705577347438955647237468102116729664175698127603494671676
        );                                      
        
        vk.IC[31] = Pairing.G1Point( 
            15566373304975774514889117333387144674060349617688436391066417319703933536409,
            6291729462831353561043717979716276881795333999608545764589259088495572191446
        );                                      
        
        vk.IC[32] = Pairing.G1Point( 
            11159866481939459862922625175126499437844709396814473559741638348174261972023,
            13551245608223496725818002326341963122646696920588575846299578445394936697604
        );                                      
        
        vk.IC[33] = Pairing.G1Point( 
            9602100026218749770550515768852385559554992231092411438137181098192389095305,
            8019607279265601945903988855444750661415915135388682463110975885623211609980
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
