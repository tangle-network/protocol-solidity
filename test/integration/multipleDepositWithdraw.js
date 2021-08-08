const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');
const Helpers = require('../helpers');
const { toBN } = require('web3-utils')
const assert = require('assert');
const BridgeContract = artifacts.require("Bridge");
const LinkableAnchorContract = artifacts.require("./LinkableERC20AnchorPoseidon2.sol");
const Verifier = artifacts.require('./VerifierPoseidonBridge.sol');
const Hasher = artifacts.require("PoseidonT3");
const Token = artifacts.require("ERC20Mock");
const AnchorHandlerContract = artifacts.require("AnchorHandler");

const fs = require('fs')
const path = require('path');
const { NATIVE_AMOUNT } = process.env
let prefix = 'poseidon-test'
const snarkjs = require('snarkjs');
const BN = require('bn.js');
const F = require('circomlib').babyJub.F;
const Scalar = require("ffjavascript").Scalar;
const MerkleTree = require('../../lib/MerkleTree');


contract('E2E LinkableAnchors - Cross chain withdraw with multiple deposits', async accounts => {
  const relayerThreshold = 2;
  const originChainID = 1;
  const destChainID = 2;
  const relayer1Address = accounts[3];
  const relayer2Address = accounts[4];
  const operator = accounts[6];

  const initialTokenMintAmount = BigInt(1e25);
  const maxRoots = 1;
  const merkleTreeHeight = 30;
  const sender = accounts[5];

  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
  const refund = BigInt((new BN('0')).toString());
  const recipient = Helpers.getRandomRecipient();

  let originMerkleRoot;
  let originBlockHeight = 1;
  let originUpdateNonce;
  let hasher, verifier;
  let originChainToken;
  let destChainToken;
  let originDeposit;
  let tokenDenomination = '1000000000000000000000'; 
  let tree;
  let createWitness;
  let OriginChainLinkableAnchorInstance;
  let originDepositData;
  let originDepositDataHash;
  let resourceID;
  let initialResourceIDs;
  let DestBridgeInstance;
  let DestChainLinkableAnchorInstance
  let DestAnchorHandlerInstance;
  let destInitialContractAddresses;

  beforeEach(async () => {
    await Promise.all([
      // instantiate bridges on dest chain side
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
    destInitialContractAddresses = [OriginChainLinkableAnchorInstance.address];
    // initialize anchorHanders 
    await Promise.all([
      AnchorHandlerContract.new(DestBridgeInstance.address, initialResourceIDs, destInitialContractAddresses)
        .then(instance => DestAnchorHandlerInstance = instance),
    ]);
    // increase allowance and set resources for bridge
    await Promise.all([
      originChainToken.approve(OriginChainLinkableAnchorInstance.address, initialTokenMintAmount, { from: sender }),
      destChainToken.approve(DestChainLinkableAnchorInstance.address, initialTokenMintAmount, { from: sender }),
      DestBridgeInstance.adminSetResource(DestAnchorHandlerInstance.address, resourceID, DestChainLinkableAnchorInstance.address)
    ]);
     // set bridge and handler permissions for anchor
     await Promise.all([
      DestChainLinkableAnchorInstance.setHandler(DestAnchorHandlerInstance.address, {from: sender}),
      DestChainLinkableAnchorInstance.setBridge(DestBridgeInstance.address, {from: sender})
     ]);

    createWitness = async (data) => {
      const wtns = {type: "mem"};
      await snarkjs.wtns.calculate(data, path.join(
        "artifacts/circuits",
        "bridge",
        "poseidon_bridge_2.wasm"
      ), wtns);
      return wtns;
    }

    tree = new MerkleTree(merkleTreeHeight, null, prefix)
    zkey_final = fs.readFileSync('build/bridge2/circuit_final.zkey').buffer;
  });

  it('[sanity] dest chain bridge configured with threshold and relayers', async () => {
    assert.equal(await DestBridgeInstance._chainID(), destChainID)
    assert.equal(await DestBridgeInstance._relayerThreshold(), relayerThreshold)
    assert.equal((await DestBridgeInstance._totalRelayers()).toString(), '2')
  })

  it('withdrawing across bridge after two deposits should work', async () => {
    // minting Tokens
    await originChainToken.mint(sender, initialTokenMintAmount);
    // deposit on both chains and define nonces based on events emmited
    let { logs } = await OriginChainLinkableAnchorInstance.deposit(
      Helpers.toFixedHex(Helpers.generateDeposit(destChainID).commitment), {from: sender});
    originUpdateNonce = logs[0].args.leafIndex;
    originMerkleRoot = await OriginChainLinkableAnchorInstance.getLastRoot();
    // create correct update proposal data for the deposit on origin chain
    originDepositData = Helpers.createUpdateProposalData(originChainID, originBlockHeight, originMerkleRoot);
    originDepositDataHash = Ethers.utils.keccak256(DestAnchorHandlerInstance.address + originDepositData.substr(2));

    // deposit on origin chain leads to update addEdge proposal on dest chain
    // relayer1 creates the deposit proposal for the deposit that occured in the before each loop
    TruffleAssert.passes(await DestBridgeInstance.voteProposal(
      originChainID,
      originUpdateNonce,
      resourceID,
      originDepositDataHash,
      { from: relayer1Address }
    ));

    // relayer2 votes in favor of the update proposal
    // because the relayerThreshold is 2, the deposit proposal will become passed
    TruffleAssert.passes(await DestBridgeInstance.voteProposal(
        originChainID,
        originUpdateNonce,
        resourceID,
        originDepositDataHash,
        { from: relayer2Address }
    ));

    // relayer1 will execute the deposit proposal
    TruffleAssert.passes(await DestBridgeInstance.executeProposal(
        originChainID,
        originUpdateNonce,
        originDepositData,
        resourceID,
        { from: relayer1Address }
    ));
      
     // deposit on origin chain and define nonce based on events emmited
     originDeposit = Helpers.generateDeposit(destChainID, 30);
     ({ logs } = await OriginChainLinkableAnchorInstance.deposit(Helpers.toFixedHex(originDeposit.commitment), {from: sender}));
     originUpdateNonce = logs[0].args.leafIndex;
     originMerkleRoot = await OriginChainLinkableAnchorInstance.getLastRoot();
     // create correct update proposal data for the deposit on origin chain
     originDepositData = Helpers.createUpdateProposalData(originChainID, originBlockHeight + 10, originMerkleRoot);
     originDepositDataHash = Ethers.utils.keccak256(DestAnchorHandlerInstance.address + originDepositData.substr(2));

    // a second deposit on origin chain leads to update edge proposal on dest chain
    // relayer1 creates the deposit proposal for the deposit that occured in the before each loop
    TruffleAssert.passes(await DestBridgeInstance.voteProposal(
      originChainID,
      originUpdateNonce,
      resourceID,
      originDepositDataHash,
      { from: relayer1Address }
    ));

    // relayer2 votes in favor of the update proposal
    // because the relayerThreshold is 2, the deposit proposal will become passed
    TruffleAssert.passes(await DestBridgeInstance.voteProposal(
      originChainID,
      originUpdateNonce,
      resourceID,
      originDepositDataHash,
      { from: relayer2Address }
    ));

    // relayer1 will execute the deposit proposal
    TruffleAssert.passes(await DestBridgeInstance.executeProposal(
      originChainID,
      originUpdateNonce,
      originDepositData,
      resourceID,
      { from: relayer1Address }
    ));
    // check roots
    const destNeighborRoots = await DestChainLinkableAnchorInstance.getLatestNeighborRoots();
    assert.strictEqual(destNeighborRoots.length, maxRoots);
    assert.strictEqual(destNeighborRoots[0], originMerkleRoot);

    // check initial balances
    let balanceOperatorBefore = await destChainToken.balanceOf(operator);
    let balanceReceiverBefore = await destChainToken.balanceOf(Helpers.toFixedHex(recipient, 20));
    let balanceDestAnchorAfterDeposits = await destChainToken.balanceOf(DestChainLinkableAnchorInstance.address);
    // insert two commitments into the tree
    await tree.insert(Helpers.generateDeposit(destChainID).commitment);
    await tree.insert(originDeposit.commitment);
  
    const { root, path_elements, path_index } = await tree.path(1);
    
    // verification fails (this discrepency is likley one of the reasons)
    assert.strictEqual(destNeighborRoots[0], Helpers.toFixedHex(root))

    const destNativeRoot = await DestChainLinkableAnchorInstance.getLastRoot();
    const input = {
      // public
      nullifierHash: originDeposit.nullifierHash,
      recipient,
      relayer: operator,
      fee,
      refund,
      chainID: originDeposit.chainID,
      roots: [destNativeRoot, ...destNeighborRoots],
      // private
      nullifier: originDeposit.nullifier,
      secret: originDeposit.secret,
      pathElements: path_elements,
      pathIndices: path_index,
      diffs: [destNativeRoot, destNeighborRoots[0]].map(r => {
        return F.sub(
          Scalar.fromString(`${r}`),
          Scalar.fromString(`${destNeighborRoots}`),
        ).toString();
      }),
    };

    const wtns = await createWitness(input);

    let res = await snarkjs.groth16.prove('test/fixtures/circuit_final.zkey', wtns);
    proof = res.proof;
    publicSignals = res.publicSignals;
    const vKey = await snarkjs.zKey.exportVerificationKey('test/fixtures/circuit_final.zkey');
    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    assert.strictEqual(res, true);

    let isSpent = await DestChainLinkableAnchorInstance.isSpent(Helpers.toFixedHex(input.nullifierHash));
    assert.strictEqual(isSpent, false);

    // Uncomment to measure gas usage
    // gas = await anchor.withdraw.estimateGas(proof, publicSignals, { from: relayer, gasPrice: '0' })
    // console.log('withdraw gas:', gas)
    const args = [
      Helpers.toFixedHex(await DestChainLinkableAnchorInstance.getLastRoot()),
      Helpers.toFixedHex(input.nullifierHash),
      Helpers.toFixedHex(input.recipient, 20),
      Helpers.toFixedHex(input.relayer, 20),
      Helpers.toFixedHex(input.fee),
      Helpers.toFixedHex(input.refund),
    ];

    const result = await Helpers.groth16ExportSolidityCallData(proof, publicSignals);
    const fullProof = JSON.parse("[" + result + "]");
    const pi_a = fullProof[0];
    const pi_b = fullProof[1];
    const pi_c = fullProof[2];
    const inputs = fullProof[3];
    assert.strictEqual(true, await verifier.verifyProof(
      pi_a,
      pi_b,
      pi_c,
      inputs,
    ));

    proofEncoded = [
      pi_a[0],
      pi_a[1],
      pi_b[0][0],
      pi_b[0][1],
      pi_b[1][0],
      pi_b[1][1],
      pi_c[0],
      pi_c[1],
    ]
    .map(elt => elt.substr(2))
    .join('');
    await destChainToken.mint(DestChainLinkableAnchorInstance.address, initialTokenMintAmount);
    
    ({ logs } = await DestChainLinkableAnchorInstance.withdraw
      (`0x${proofEncoded}`, ...args, { from: input.relayer, gasPrice: '0' }));
    
    let balanceDestAnchorAfter = await destChainToken.balanceOf(DestChainLinkableAnchorInstance.address);
    let balanceOperatorAfter = await destChainToken.balanceOf(input.relayer);
    let balanceReceiverAfter = await destChainToken.balanceOf(Helpers.toFixedHex(recipient, 20));
    const feeBN = toBN(fee.toString())
    console.log('balanceDestAnchorAfterDeposits: ', balanceDestAnchorAfterDeposits.toString());
    console.log('balanceOperatorBefore: ', balanceOperatorBefore.toString());
    console.log('balanceReceiverBefore: ', balanceReceiverBefore.toString());
    console.log('balanceDestAnchorAfter: ', balanceDestAnchorAfter.toString());
    console.log('balanceOperatorAfter: ', balanceOperatorAfter.toString());
    console.log('balanceReceiverAfter: ', balanceReceiverAfter.toString());
    console.log('feeBN: ', feeBN.toString());
    assert.strictEqual(balanceDestAnchorAfter.toString(), balanceDestAnchorAfterDeposits.sub(toBN(tokenDenomination)).toString());
    assert.strictEqual(balanceOperatorAfter.toString(), balanceOperatorBefore.add(feeBN).toString());
    assert.strictEqual(balanceReceiverAfter.toString(), balanceReceiverBefore.add(toBN(tokenDenomination)).sub(feeBN).toString());
    
    assert.strictEqual(logs[0].event, 'Withdrawal');
    assert.strictEqual(logs[0].args.nullifierHash, Helpers.toFixedHex(input.nullifierHash));
    assert.strictEqual(logs[0].args.relayer, operator);
    assert.strictEqual(logs[0].args.fee.toString(), feeBN.toString());
    
    isSpent = await DestChainLinkableAnchorInstance.isSpent(Helpers.toFixedHex(input.nullifierHash));
    assert(isSpent);

    })      
})
