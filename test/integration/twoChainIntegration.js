const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');
const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const LinkableAnchorContract = artifacts.require("./LinkableERC20AnchorPoseidon2.sol");
 const Verifier = artifacts.require('./VerifierPoseidonBridge.sol');
 const Hasher = artifacts.require("PoseidonT3");
 const Token = artifacts.require("ERC20Mock");
const AnchorHandlerContract = artifacts.require("AnchorHandler");

const fs = require('fs')
const path = require('path');
const { toBN, randomHex } = require('web3-utils')
const Poseidon = artifacts.require('PoseidonT3');
const { NATIVE_AMOUNT, MERKLE_TREE_HEIGHT } = process.env
let prefix = 'poseidon-test'
const snarkjs = require('snarkjs')
const bigInt = require('big-integer');
const BN = require('bn.js');
const crypto = require('crypto')
const circomlib = require('circomlib');
const F = require('circomlib').babyJub.F;
const Scalar = require("ffjavascript").Scalar;
const helpers = require('../helpers');

const utils = require("ffjavascript").utils;
const {
  leBuff2int,
  leInt2Buff,
  stringifyBigInts,
} = utils;
const PoseidonHasher = require('../../lib/Poseidon'); 
const MerkleTree = require('../../lib/MerkleTree');

function bigNumberToPaddedBytes(num, digits =  32) {
  var n = num.toString(16).replace(/^0x/, '');
  while (n.length < (digits * 2)) {
      n = "0" + n;
  }
  return "0x" + n;
}

const poseidonHasher = new PoseidonHasher();
const rbigint = (nbytes) => leBuff2int(crypto.randomBytes(nbytes))
const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]
const toFixedHex = (number, length = 32) =>
  '0x' +
  BigInt(`${number}`)
    .toString(16)
    .padStart(length * 2, '0')
const getRandomRecipient = () => rbigint(20)

function generateDeposit(targetChainID) {
  let deposit = {
    chainID: BigInt(targetChainID),
    secret: rbigint(31),
    nullifier: rbigint(31),
  }

  deposit.commitment = poseidonHasher.hash3([deposit.chainID, deposit.nullifier, deposit.secret]);
  deposit.nullifierHash =   poseidonHasher.hash(null, deposit.nullifier, deposit.nullifier);
  return deposit
}

contract('E2E LinkableAnchors - Two EVM Chains', async accounts => {
    const relayerThreshold = 2;
    const originChainID = 1;
    const destChainID = 2;
    const relayer1Address = accounts[3];
    const relayer2Address = accounts[4];
    const relayer1Bit = 1 << 0;

    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const initialTokenAmount = 10000000000000;
    const levels = MERKLE_TREE_HEIGHT || 30
    const maxRoots = 1;
    const merkleTreeHeight = 30;
    const sender = accounts[5];

    const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
    const refund = BigInt((new BN('0')).toString());
    const recipient = getRandomRecipient();
    const relayer = accounts[6];


    let originMerkleRoot;
    let destMerkleRoot;
    let originBlockHeight = 1;
    let destBlockHeight = 1;
    let originUpdateNonce = 1;
    let destUpdateNonce = 1;
    let hasher, verifier;
    let originChainToken;
    let destChainToken;
    let tokenDenomination = '1000'; 
    let tree;
    let createWitness;
    let OriginBridgeInstance;
    let OriginChainLinkableAnchorInstance;
    let OriginAnchorHandlerInstance;
    let originDepositData;
    let originDepositDataHash;
    let resourceID;
    let initialResourceIDs;
    let originInitialContractAddresses;
    let DestBridgeInstance;
    let DestChainLinkableAnchorInstance
    let DestAnchorHandlerInstance;
    let destDepositData;
    let destDepositDataHash;
    let destInitialContractAddresses;

    beforeEach(async () => {
        await Promise.all([
            // instantiate bridges on both sides
            BridgeContract.new(originChainID, [relayer1Address, relayer2Address], relayerThreshold, 0, 100).then(instance => OriginBridgeInstance = instance),
            BridgeContract.new(destChainID, [relayer1Address, relayer2Address], relayerThreshold, 0, 100).then(instance => DestBridgeInstance = instance),
            // create hasher, verifier, and tokens
            Hasher.new().then(instance => hasher = instance),
            Verifier.new().then(instance => verifier = instance),
            Token.new().then(instance => originChainToken = instance),
            Token.new().then(instance => destChainToken = instance),
        ]);
        // initialize anchors on both chains
        OriginChainLinkableAnchorInstance = await LinkableAnchorContract.new(
            verifier.address,
            hasher.address,
            tokenDenomination,
            merkleTreeHeight,
            originChainID,
            originChainToken.address,
        {from: sender});
        DestChainLinkableAnchorInstance = await LinkableAnchorContract.new(
            verifier.address,
            hasher.address,
            tokenDenomination,
            merkleTreeHeight,
            destChainID,
            destChainToken.address,
        {from: sender});
        // create resource ID using anchor address (this follows create2 scheme)
        resourceID = Helpers.createResourceID(OriginChainLinkableAnchorInstance.address, 0);
        initialResourceIDs = [resourceID];
        originInitialContractAddresses = [DestChainLinkableAnchorInstance.address];
        destInitialContractAddresses = [OriginChainLinkableAnchorInstance.address];
        
        // initialize anchorHanders 
        await Promise.all([
            AnchorHandlerContract.new(OriginBridgeInstance.address, initialResourceIDs, originInitialContractAddresses)
                .then(instance => OriginAnchorHandlerInstance = instance),
            AnchorHandlerContract.new(DestBridgeInstance.address, initialResourceIDs, destInitialContractAddresses)
                .then(instance => DestAnchorHandlerInstance = instance),
        ]);

        await originChainToken.mint(sender, initialTokenAmount);
        await destChainToken.mint(sender, initialTokenAmount);
        // increase allowance and set resources for bridge
        await Promise.all([
            originChainToken.approve(OriginChainLinkableAnchorInstance.address, initialTokenAmount, { from: sender }),
            destChainToken.approve(DestChainLinkableAnchorInstance.address, initialTokenAmount, { from: sender }),
            OriginBridgeInstance.adminSetResource(OriginAnchorHandlerInstance.address, resourceID, OriginChainLinkableAnchorInstance.address),
            DestBridgeInstance.adminSetResource(DestAnchorHandlerInstance.address, resourceID, DestChainLinkableAnchorInstance.address)
        ]);
        
        // deposit on both chains and define nonces based on events emmited
        let { logs } = await OriginChainLinkableAnchorInstance.deposit(toFixedHex(42), {from: sender});
        originUpdateNonce = logs[0].args.updateNonce;
        originMerkleRoot = await OriginChainLinkableAnchorInstance.getLastRoot();
        ({logs} = await DestChainLinkableAnchorInstance.deposit(toFixedHex(40), {from: sender}));
        destUpdateNonce = logs[0].args.updateNonce;
        destMerkleRoot = await DestChainLinkableAnchorInstance.getLastRoot();
        // set bridge and handler permissions for anchors
        await OriginChainLinkableAnchorInstance.setHandler(OriginAnchorHandlerInstance.address, {from: sender});
        await OriginChainLinkableAnchorInstance.setBridge(OriginBridgeInstance.address, {from: sender});
        await DestChainLinkableAnchorInstance.setHandler(DestAnchorHandlerInstance.address, {from: sender});
        await DestChainLinkableAnchorInstance.setBridge(DestBridgeInstance.address, {from: sender});
        // create correct update proposal data for the deposits on both chains
        originDepositData = Helpers.createUpdateProposalData(originChainID, originBlockHeight, originMerkleRoot,);
        originDepositDataHash = Ethers.utils.keccak256(DestAnchorHandlerInstance.address + originDepositData.substr(2));
        destDepositData = Helpers.createUpdateProposalData(destChainID, destBlockHeight, destMerkleRoot);
        destDepositDataHash = Ethers.utils.keccak256(OriginAnchorHandlerInstance.address + destDepositData.substr(2));
    
        createWitness = async (data) => {
          const wtns = {type: "mem"};
          await snarkjs.wtns.calculate(data, path.join(
            "artifacts/circuits",
            "bridge",
            "poseidon_bridge_2.wasm"
          ), wtns);
          return wtns;
        }
    
        tree = new MerkleTree(levels, null, prefix)
        zkey_final = fs.readFileSync('build/bridge2/circuit_final.zkey').buffer;
    });

    it('[sanity] origin chain bridge configured with threshold and relayers', async () => {
        assert.equal(await OriginBridgeInstance._chainID(), originChainID);
        assert.equal(await OriginBridgeInstance._relayerThreshold(), relayerThreshold)
        assert.equal((await OriginBridgeInstance._totalRelayers()).toString(), '2')
    })

    it('[sanity] deposit chain bridge configured with threshold and relayers', async () => {
        assert.equal(await DestBridgeInstance._chainID(), destChainID)
        assert.equal(await DestBridgeInstance._relayerThreshold(), relayerThreshold)
        assert.equal((await DestBridgeInstance._totalRelayers()).toString(), '2')
    })

    it('[sanity] updateProposal on origin chain should be created with expected values', async () => {
        await TruffleAssert.passes(OriginBridgeInstance.voteProposal(
            destChainID, originUpdateNonce, resourceID, destDepositDataHash, {from: relayer1Address}));

        const expectedUpdateProposal = {
            _yesVotes: relayer1Bit.toString(),
            _yesVotesTotal: '1',
            _status: '1' // Active
        };

        const updateProposal = await OriginBridgeInstance.getProposal(
            destChainID, originUpdateNonce, destDepositDataHash);

        assert.deepInclude(Object.assign({}, updateProposal), expectedUpdateProposal);
    });

    it('[sanity] updateProposal on destination chain should be created with expected values', async () => {
        await TruffleAssert.passes(DestBridgeInstance.voteProposal(
            originChainID, destUpdateNonce, resourceID, originDepositDataHash, {from: relayer1Address}));

        const expectedUpdateProposal = {
            _yesVotes: relayer1Bit.toString(),
            _yesVotesTotal: '1',
            _status: '1' // Active
        };

        const updateProposal = await DestBridgeInstance.getProposal(
            originChainID, destUpdateNonce, originDepositDataHash);

        assert.deepInclude(Object.assign({}, updateProposal), expectedUpdateProposal);
    });

    it("E2E: deposit on origin chain withdraw on destination chain", async () => {
        // relayer1 creates the deposit proposal for the deposit that occured in the before each loop
        TruffleAssert.passes(await DestBridgeInstance.voteProposal(
            originChainID,
            destUpdateNonce,
            resourceID,
            originDepositDataHash,
            { from: relayer1Address }
        ));

        // relayer2 votes in favor of the update proposal
        // because the relayerThreshold is 2, the deposit proposal will become passed
        TruffleAssert.passes(await DestBridgeInstance.voteProposal(
            originChainID,
            destUpdateNonce,
            resourceID,
            originDepositDataHash,
            { from: relayer2Address }
        ));

        // relayer1 will execute the deposit proposal
        TruffleAssert.passes(await DestBridgeInstance.executeProposal(
            originChainID,
            destUpdateNonce,
            originDepositData,
            resourceID,
            { from: relayer1Address }
        ));
        // checking edge is added
        const destChainRoots = await DestChainLinkableAnchorInstance.getLatestNeighborRoots();
        assert.strictEqual(destChainRoots.length, maxRoots);
        assert.strictEqual(destChainRoots[0], originMerkleRoot);

        // native verification
        const deposit = generateDeposit(destChainID);
        await tree.insert(deposit.commitment);
        const { root, path_elements, path_index } = await tree.path(0);
        const roots = [root, 0];
        const diffs = roots.map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        });
        // mock set membership gadget computation
        for (var i = 0; i < roots.length; i++) {
          assert.strictEqual(Scalar.fromString(roots[i]), F.add(Scalar.fromString(diffs[i]), Scalar.fromString(root)));
        }
  
        const input = {
          // public
          nullifierHash: deposit.nullifierHash,
          recipient,
          relayer,
          fee,
          refund,
          chainID: deposit.chainID,
          roots: [root, 0],
          // private
          nullifier: deposit.nullifier,
          secret: deposit.secret,
          pathElements: path_elements,
          pathIndices: path_index,
          diffs: [root, 0].map(r => {
            return F.sub(
              Scalar.fromString(`${r}`),
              Scalar.fromString(`${root}`),
            ).toString();
          }),
        };
  
        const wtns = await createWitness(input);
  
        let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
        proof = res.proof;
        publicSignals = res.publicSignals;
        let tempSignals = publicSignals;
        const vKey = await snarkjs.zKey.exportVerificationKey('build/bridge2/circuit_final.zkey');
  
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, true);
  
        // nullifier
        publicSignals[0] = '133792158246920651341275668520530514036799294649489851421007411546007850802'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
  
        // try to cheat with recipient
        publicSignals[1] = '133738360804642228759657445999390850076318544422'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
  
        // fee
        publicSignals[2] = '1337100000000000000000'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
    });

    it("E2E: deposit and withdraw on both chains", async () => {
        // deposit on origin chain leads to update proposal on dest chain
        // relayer1 creates the deposit proposal for the deposit that occured in the before each loop
        TruffleAssert.passes(await DestBridgeInstance.voteProposal(
            originChainID,
            destUpdateNonce,
            resourceID,
            originDepositDataHash,
            { from: relayer1Address }
        ));

        // relayer2 votes in favor of the update proposal
        // because the relayerThreshold is 2, the deposit proposal will become passed
        TruffleAssert.passes(await DestBridgeInstance.voteProposal(
            originChainID,
            destUpdateNonce,
            resourceID,
            originDepositDataHash,
            { from: relayer2Address }
        ));

        // relayer1 will execute the deposit proposal
        TruffleAssert.passes(await DestBridgeInstance.executeProposal(
            originChainID,
            destUpdateNonce,
            originDepositData,
            resourceID,
            { from: relayer1Address }
        ));
        // same process but for a deposit on dest chain leading to update on origin chain
        // relayer1 creates the deposit proposal for the deposit that occured in the before each loop
        TruffleAssert.passes(await OriginBridgeInstance.voteProposal(
            destChainID,
            originUpdateNonce,
            resourceID,
            destDepositDataHash,
            { from: relayer1Address }
        ));

        // relayer2 votes in favor of the update proposal
        // because the relayerThreshold is 2, the deposit proposal will become passed
        TruffleAssert.passes(await OriginBridgeInstance.voteProposal(
            destChainID,
            originUpdateNonce,
            resourceID,
            destDepositDataHash,
            { from: relayer2Address }
        ));

        // relayer2 will execute the deposit proposal
        TruffleAssert.passes(await OriginBridgeInstance.executeProposal(
            destChainID,
            originUpdateNonce,
            destDepositData,
            resourceID,
            { from: relayer2Address }
        ));
        // checking edges are added on both destChain and originChain
        const destChainRoots = await DestChainLinkableAnchorInstance.getLatestNeighborRoots();
        assert.strictEqual(destChainRoots.length, maxRoots);
        assert.strictEqual(destChainRoots[0], originMerkleRoot);
        const originChainRoots = await OriginChainLinkableAnchorInstance.getLatestNeighborRoots();
        assert.strictEqual(originChainRoots.length, maxRoots);
        assert.strictEqual(originChainRoots[0], destMerkleRoot);

        // native verification for dest chain
        let deposit = generateDeposit(destChainID);
        await tree.insert(deposit.commitment);
        let { root, path_elements, path_index } = await tree.path(0);
        let roots = [root, 0];
        let diffs = roots.map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        });
        // mock set membership gadget computation
        for (var i = 0; i < roots.length; i++) {
          assert.strictEqual(Scalar.fromString(roots[i]), F.add(Scalar.fromString(diffs[i]), Scalar.fromString(root)));
        }
  
        let input = {
          // public
          nullifierHash: deposit.nullifierHash,
          recipient,
          relayer,
          fee,
          refund,
          chainID: deposit.chainID,
          roots: [root, 0],
          // private
          nullifier: deposit.nullifier,
          secret: deposit.secret,
          pathElements: path_elements,
          pathIndices: path_index,
          diffs: [root, 0].map(r => {
            return F.sub(
              Scalar.fromString(`${r}`),
              Scalar.fromString(`${root}`),
            ).toString();
          }),
        };
  
        let wtns = await createWitness(input);
  
        let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
        proof = res.proof;
        publicSignals = res.publicSignals;
        let tempSignals = publicSignals;
        let vKey = await snarkjs.zKey.exportVerificationKey('build/bridge2/circuit_final.zkey');
  
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, true);
  
        // nullifier
        publicSignals[0] = '133792158246920651341275668520530514036799294649489851421007411546007850802'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
  
        // try to cheat with recipient
        publicSignals[1] = '133738360804642228759657445999390850076318544422'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
  
        // fee
        publicSignals[2] = '1337100000000000000000'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;

        // native verification for origin chain
        // reset tree
        tree = new MerkleTree(levels, null, prefix)
        deposit = generateDeposit(originChainID);
        await tree.insert(deposit.commitment);
        ({ root, path_elements, path_index } = await tree.path(0));
        roots = [root, 0];
        diffs = roots.map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        });
        // mock set membership gadget computation
        for (var i = 0; i < roots.length; i++) {
          assert.strictEqual(Scalar.fromString(roots[i]), F.add(Scalar.fromString(diffs[i]), Scalar.fromString(root)));
        }
  
        input = {
          // public
          nullifierHash: deposit.nullifierHash,
          recipient,
          relayer,
          fee,
          refund,
          chainID: deposit.chainID,
          roots: [root, 0],
          // private
          nullifier: deposit.nullifier,
          secret: deposit.secret,
          pathElements: path_elements,
          pathIndices: path_index,
          diffs: [root, 0].map(r => {
            return F.sub(
              Scalar.fromString(`${r}`),
              Scalar.fromString(`${root}`),
            ).toString();
          }),
        };
  
        wtns = await createWitness(input);
  
        res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
        proof = res.proof;
        publicSignals = res.publicSignals;
        tempSignals = publicSignals;
        vKey = await snarkjs.zKey.exportVerificationKey('build/bridge2/circuit_final.zkey');
  
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, true);
  
        // nullifier
        publicSignals[0] = '133792158246920651341275668520530514036799294649489851421007411546007850802'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
  
        // try to cheat with recipient
        publicSignals[1] = '133738360804642228759657445999390850076318544422'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
  
        // fee
        publicSignals[2] = '1337100000000000000000'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
    });

    it("E2E: adding edges on both chains and updating an edge on one", async () => {
        // deposit on origin chain leads to update proposal on dest chain
        // relayer1 creates the deposit proposal for the deposit that occured in the before each loop
        TruffleAssert.passes(await DestBridgeInstance.voteProposal(
            originChainID,
            destUpdateNonce,
            resourceID,
            originDepositDataHash,
            { from: relayer1Address }
        ));

        // relayer2 votes in favor of the update proposal
        // because the relayerThreshold is 2, the deposit proposal will become passed
        TruffleAssert.passes(await DestBridgeInstance.voteProposal(
            originChainID,
            destUpdateNonce,
            resourceID,
            originDepositDataHash,
            { from: relayer2Address }
        ));

        // relayer1 will execute the deposit proposal
        TruffleAssert.passes(await DestBridgeInstance.executeProposal(
            originChainID,
            destUpdateNonce,
            originDepositData,
            resourceID,
            { from: relayer1Address }
        ));
        // same process but for a deposit on dest chain leading to update on origin chain
        // relayer1 creates the deposit proposal for the deposit that occured in the before each loop
        TruffleAssert.passes(await OriginBridgeInstance.voteProposal(
            destChainID,
            originUpdateNonce,
            resourceID,
            destDepositDataHash,
            { from: relayer1Address }
        ));

        // relayer2 votes in favor of the update proposal
        // because the relayerThreshold is 2, the deposit proposal will become passed
        TruffleAssert.passes(await OriginBridgeInstance.voteProposal(
            destChainID,
            originUpdateNonce,
            resourceID,
            destDepositDataHash,
            { from: relayer2Address }
        ));

        // relayer2 will execute the deposit proposal
        TruffleAssert.passes(await OriginBridgeInstance.executeProposal(
            destChainID,
            originUpdateNonce,
            destDepositData,
            resourceID,
            { from: relayer2Address }
        ));

        // new deposit on originChain changes root 
        ({ logs } = await OriginChainLinkableAnchorInstance.deposit(toFixedHex(46), {from: sender}));
        destUpdateNonce = logs[0].args.updateNonce;
        originMerkleRoot = await OriginChainLinkableAnchorInstance.getLastRoot();
        originDepositData = Helpers.createUpdateProposalData(originChainID, originBlockHeight + 10, originMerkleRoot);
        originDepositDataHash = Ethers.utils.keccak256(DestAnchorHandlerInstance.address + originDepositData.substr(2));
        
        // deposit on origin chain leads to update edge proposal on dest chain
        // relayer1 creates the deposit proposal for the deposit that occured in the before each loop
        TruffleAssert.passes(await DestBridgeInstance.voteProposal(
            originChainID,
            destUpdateNonce,
            resourceID,
            originDepositDataHash,
            { from: relayer1Address }
        ));

        // relayer2 votes in favor of the update proposal
        // because the relayerThreshold is 2, the deposit proposal will become passed
        TruffleAssert.passes(await DestBridgeInstance.voteProposal(
            originChainID,
            destUpdateNonce,
            resourceID,
            originDepositDataHash,
            { from: relayer2Address }
        ));

        // relayer1 will execute the deposit proposal
        TruffleAssert.passes(await DestBridgeInstance.executeProposal(
            originChainID,
            destUpdateNonce,
            originDepositData,
            resourceID,
            { from: relayer1Address }
        ));


        // checking edge is updted correctly
        const destChainRoots = await DestChainLinkableAnchorInstance.getLatestNeighborRoots();
        assert.strictEqual(destChainRoots.length, maxRoots);
        assert.strictEqual(destChainRoots[0], originMerkleRoot);
        const originChainRoots = await OriginChainLinkableAnchorInstance.getLatestNeighborRoots();
        assert.strictEqual(originChainRoots.length, maxRoots);
        assert.strictEqual(originChainRoots[0], destMerkleRoot);

        // native verification for dest chain
        let deposit = generateDeposit(destChainID);
        await tree.insert(deposit.commitment);
        let { root, path_elements, path_index } = await tree.path(0);
        let roots = [root, 0];
        let diffs = roots.map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        });
        // mock set membership gadget computation
        for (var i = 0; i < roots.length; i++) {
          assert.strictEqual(Scalar.fromString(roots[i]), F.add(Scalar.fromString(diffs[i]), Scalar.fromString(root)));
        }
  
        let input = {
          // public
          nullifierHash: deposit.nullifierHash,
          recipient,
          relayer,
          fee,
          refund,
          chainID: deposit.chainID,
          roots: [root, 0],
          // private
          nullifier: deposit.nullifier,
          secret: deposit.secret,
          pathElements: path_elements,
          pathIndices: path_index,
          diffs: [root, 0].map(r => {
            return F.sub(
              Scalar.fromString(`${r}`),
              Scalar.fromString(`${root}`),
            ).toString();
          }),
        };
  
        let wtns = await createWitness(input);
  
        let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
        proof = res.proof;
        publicSignals = res.publicSignals;
        let tempSignals = publicSignals;
        let vKey = await snarkjs.zKey.exportVerificationKey('build/bridge2/circuit_final.zkey');
  
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, true);
  
        // nullifier
        publicSignals[0] = '133792158246920651341275668520530514036799294649489851421007411546007850802'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
  
        // try to cheat with recipient
        publicSignals[1] = '133738360804642228759657445999390850076318544422'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
  
        // fee
        publicSignals[2] = '1337100000000000000000'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;

        // native verification for origin chain
        // reset tree
        tree = new MerkleTree(levels, null, prefix)
        deposit = generateDeposit(originChainID);
        await tree.insert(deposit.commitment);
        ({ root, path_elements, path_index } = await tree.path(0));
        roots = [root, 0];
        diffs = roots.map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        });
        // mock set membership gadget computation
        for (var i = 0; i < roots.length; i++) {
          assert.strictEqual(Scalar.fromString(roots[i]), F.add(Scalar.fromString(diffs[i]), Scalar.fromString(root)));
        }
  
        input = {
          // public
          nullifierHash: deposit.nullifierHash,
          recipient,
          relayer,
          fee,
          refund,
          chainID: deposit.chainID,
          roots: [root, 0],
          // private
          nullifier: deposit.nullifier,
          secret: deposit.secret,
          pathElements: path_elements,
          pathIndices: path_index,
          diffs: [root, 0].map(r => {
            return F.sub(
              Scalar.fromString(`${r}`),
              Scalar.fromString(`${root}`),
            ).toString();
          }),
        };
  
        wtns = await createWitness(input);
  
        res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
        proof = res.proof;
        publicSignals = res.publicSignals;
        tempSignals = publicSignals;
        vKey = await snarkjs.zKey.exportVerificationKey('build/bridge2/circuit_final.zkey');
  
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, true);
  
        // nullifier
        publicSignals[0] = '133792158246920651341275668520530514036799294649489851421007411546007850802'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
  
        // try to cheat with recipient
        publicSignals[1] = '133738360804642228759657445999390850076318544422'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
  
        // fee
        publicSignals[2] = '1337100000000000000000'
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        assert.strictEqual(res, false)
        publicSignals = tempSignals;
    });

    afterEach(async () => {
        tree = new MerkleTree(levels, null, prefix)
    })
})
    
