const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');
const helpers = require('../helpers');
const { toBN } = require('web3-utils')
const assert = require('assert');
const BridgeContract = artifacts.require('Bridge');
const LinkableAnchorContract = artifacts.require('./LinkableERC20AnchorPoseidon2.sol');
const Verifier = artifacts.require('./VerifierPoseidonBridge.sol');
const Hasher = artifacts.require('PoseidonT3');
const Token = artifacts.require('ERC20Mock');
const AnchorHandlerContract = artifacts.require('AnchorHandler');

const fs = require('fs')
const path = require('path');
const { NATIVE_AMOUNT } = process.env
let prefix = 'poseidon-test'
const snarkjs = require('snarkjs');
const BN = require('bn.js');
const F = require('circomlib').babyJub.F;
const Scalar = require('ffjavascript').Scalar;
const MerkleTree = require('../../lib/MerkleTree');


contract('E2E LinkableAnchors - Cross chain withdrawals', async accounts => {
  const relayerThreshold = 1;
  const originChainID = 1;
  const destChainID = 2;
  const relayer1Address = accounts[3];
  const relayer2Address = accounts[4];
  const operator = accounts[6];
  const initialTokenMintAmount = BigInt(1e25);
  const tokenDenomination = '1000000000000000000000'; 
  const maxRoots = 1;
  const merkleTreeHeight = 30;
  const sender = accounts[5];
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
  const refund = BigInt((new BN('0')).toString());
  const recipient = helpers.getRandomRecipient();

  let originMerkleRoot;
  let destMerkleRoot;
  let originBlockHeight = 1;
  let destBlockHeight = 1;
  let originUpdateNonce;
  let destUpdateNonce;
  let hasher, verifier;
  let originChainToken;
  let destChainToken;
  let originDeposit;
  let destDeposit;
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
      BridgeContract.new(originChainID, [relayer1Address], relayerThreshold, 0, 100).then(instance => OriginBridgeInstance = instance),
      BridgeContract.new(destChainID, [relayer1Address], relayerThreshold, 0, 100).then(instance => DestBridgeInstance = instance),
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
    // create resource ID using anchor address
    resourceID = helpers.createResourceID(OriginChainLinkableAnchorInstance.address, 0);
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
    // increase allowance and set resources for bridge
    await Promise.all([
      OriginBridgeInstance.adminSetResource(OriginAnchorHandlerInstance.address, resourceID, OriginChainLinkableAnchorInstance.address),
      DestBridgeInstance.adminSetResource(DestAnchorHandlerInstance.address, resourceID, DestChainLinkableAnchorInstance.address)
    ]);
     // set bridge and handler permissions for anchors
    await Promise.all([
      OriginChainLinkableAnchorInstance.setHandler(OriginAnchorHandlerInstance.address, {from: sender}),
      OriginChainLinkableAnchorInstance.setBridge(OriginBridgeInstance.address, {from: sender}),
      DestChainLinkableAnchorInstance.setHandler(DestAnchorHandlerInstance.address, {from: sender}),
      DestChainLinkableAnchorInstance.setBridge(DestBridgeInstance.address, {from: sender})
    ]);

    createWitness = async (data) => {
      const wtns = {type: 'mem'};
      await snarkjs.wtns.calculate(data, path.join(
        'test',
        'fixtures',
        'poseidon_bridge_2.wasm'
      ), wtns);
      return wtns;
    }

    tree = new MerkleTree(merkleTreeHeight, null, prefix)
    zkey_final = fs.readFileSync('test/fixtures/circuit_final.zkey').buffer;
  });

  it('[sanity] bridges configured with threshold and relayers', async () => {
    assert.equal(await OriginBridgeInstance._chainID(), originChainID);
    assert.equal(await OriginBridgeInstance._relayerThreshold(), relayerThreshold)
    assert.equal((await OriginBridgeInstance._totalRelayers()).toString(), '1')
    assert.equal(await DestBridgeInstance._chainID(), destChainID)
    assert.equal(await DestBridgeInstance._relayerThreshold(), relayerThreshold)
    assert.equal((await DestBridgeInstance._totalRelayers()).toString(), '1')
  })

  it('withdrawals on both chains integration', async () => {
    /*
    *  sender deposits on origin chain
    */
    // minting Tokens
    await originChainToken.mint(sender, initialTokenMintAmount);
    // increasing allowance of anchors
    await originChainToken.approve(OriginChainLinkableAnchorInstance.address, initialTokenMintAmount, { from: sender }),
    // generate deposit commitment targeting withdrawal on destination chain
    originDeposit = helpers.generateDeposit(destChainID);
    // deposit on origin chain and define nonce
    let { logs } = await OriginChainLinkableAnchorInstance.deposit(helpers.toFixedHex(originDeposit.commitment), {from: sender});
    originUpdateNonce = logs[0].args.leafIndex;
    originMerkleRoot = await OriginChainLinkableAnchorInstance.getLastRoot();
    // create correct update proposal data for the deposit on origin chain
    originDepositData = helpers.createUpdateProposalData(originChainID, originBlockHeight, originMerkleRoot);
    originDepositDataHash = Ethers.utils.keccak256(DestAnchorHandlerInstance.address + originDepositData.substr(2));
    /*
    *  Relayers vote on dest chain
    */
    // deposit on origin chain leads to update proposal on dest chain
    // relayer1 creates the deposit proposal for the deposit
    await TruffleAssert.passes(DestBridgeInstance.voteProposal(
      originChainID,
      originUpdateNonce,
      resourceID,
      originDepositDataHash,
      { from: relayer1Address }
    ));
    // relayer1 will execute the deposit proposal
    await TruffleAssert.passes(DestBridgeInstance.executeProposal(
      originChainID,
      originUpdateNonce,
      originDepositData,
      resourceID,
      { from: relayer1Address }
    ));

    const destNeighborRoots = await DestChainLinkableAnchorInstance.getLatestNeighborRoots();
    assert.strictEqual(destNeighborRoots.length, maxRoots);
    assert.strictEqual(destNeighborRoots[0], originMerkleRoot);
    // check initial balances
    let balanceOperatorBefore = await destChainToken.balanceOf(operator);
    let balanceReceiverBefore = await destChainToken.balanceOf(helpers.toFixedHex(recipient, 20));
    /*
    *  sender generates proof
    */
    await tree.insert(originDeposit.commitment);

    let { root, path_elements, path_index } = await tree.path(0);
    const destNativeRoot = await DestChainLinkableAnchorInstance.getLastRoot();
    let input = {
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
      diffs: [destNativeRoot, ...destNeighborRoots].map(r => {
        return F.sub(
          Scalar.fromString(`${r}`),
          Scalar.fromString(`${destNeighborRoots[0]}`),
        ).toString();
      }),
    };

    let wtns = await createWitness(input);

    let res = await snarkjs.groth16.prove('test/fixtures/circuit_final.zkey', wtns);
    proof = res.proof;
    publicSignals = res.publicSignals;
    let vKey = await snarkjs.zKey.exportVerificationKey('test/fixtures/circuit_final.zkey');
    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    assert.strictEqual(res, true);
    let args = [
      helpers.createRootsBytes(input.roots),
      helpers.toFixedHex(input.nullifierHash),
      helpers.toFixedHex(input.recipient, 20),
      helpers.toFixedHex(input.relayer, 20),
      helpers.toFixedHex(input.fee),
      helpers.toFixedHex(input.refund),
    ];

    let proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);
    /*
    *  sender withdraws on dest chain
    */
    await destChainToken.mint(DestChainLinkableAnchorInstance.address, initialTokenMintAmount);
    let balanceDestAnchorAfterDeposit = await destChainToken.balanceOf(DestChainLinkableAnchorInstance.address);
    ({ logs } = await DestChainLinkableAnchorInstance.withdraw
      (`0x${proofEncoded}`, ...args, { from: input.relayer, gasPrice: '0' }));
    
    let balanceDestAnchorAfter = await destChainToken.balanceOf(DestChainLinkableAnchorInstance.address);
    let balanceOperatorAfter = await destChainToken.balanceOf(input.relayer);
    let balanceReceiverAfter = await destChainToken.balanceOf(helpers.toFixedHex(recipient, 20));
    const feeBN = toBN(fee.toString())
    assert.strictEqual(balanceDestAnchorAfter.toString(), balanceDestAnchorAfterDeposit.sub(toBN(tokenDenomination)).toString());
    assert.strictEqual(balanceOperatorAfter.toString(), balanceOperatorBefore.add(feeBN).toString());
    assert.strictEqual(balanceReceiverAfter.toString(), balanceReceiverBefore.add(toBN(tokenDenomination)).sub(feeBN).toString());

    isSpent = await DestChainLinkableAnchorInstance.isSpent(helpers.toFixedHex(input.nullifierHash));
    assert(isSpent);
    /*
    *  sender deposit on dest chain
    */
    // minting Tokens
    await destChainToken.mint(sender, initialTokenMintAmount);
    // approval
    await destChainToken.approve(DestChainLinkableAnchorInstance.address, initialTokenMintAmount, { from: sender }),
    // generate deposit commitment
    destDeposit = helpers.generateDeposit(originChainID);
    // deposit on dest chain and define nonce
    ({logs} = await DestChainLinkableAnchorInstance.deposit(helpers.toFixedHex(destDeposit.commitment), {from: sender}));
    destUpdateNonce = logs[0].args.leafIndex;
    destMerkleRoot = await DestChainLinkableAnchorInstance.getLastRoot();
    // create correct update proposal data for the deposit on dest chain
    destDepositData = helpers.createUpdateProposalData(destChainID, destBlockHeight, destMerkleRoot);
    destDepositDataHash = Ethers.utils.keccak256(OriginAnchorHandlerInstance.address + destDepositData.substr(2));
    /*
    *  relayers vote on origin chain
    */
    // deposit on dest chain leads to update proposal on origin chain
    // relayer1 creates the deposit proposal
    await TruffleAssert.passes(OriginBridgeInstance.voteProposal(
      destChainID,
      destUpdateNonce,
      resourceID,
      destDepositDataHash,
      { from: relayer1Address }
    ));
    // relayer1 will execute the update proposal
    await TruffleAssert.passes(OriginBridgeInstance.executeProposal(
      destChainID,
      destUpdateNonce,
      destDepositData,
      resourceID,
      { from: relayer1Address }
    ));
    const originNeighborRoots = await OriginChainLinkableAnchorInstance.getLatestNeighborRoots();
    assert.strictEqual(originNeighborRoots.length, maxRoots);
    assert.strictEqual(originNeighborRoots[0], destMerkleRoot);
    // check initial balances
    balanceOperatorBefore = await originChainToken.balanceOf(operator);
    balanceReceiverBefore = await originChainToken.balanceOf(helpers.toFixedHex(recipient, 20));
    /*
    *  sender generates proof
    */
    tree = new MerkleTree(merkleTreeHeight, null, prefix)  
    await tree.insert(destDeposit.commitment);

    ({ root, path_elements, path_index } = await tree.path(0));
    const originNativeRoot = await OriginChainLinkableAnchorInstance.getLastRoot();
    input = {
      // public
      nullifierHash: destDeposit.nullifierHash,
      recipient,
      relayer: operator,
      fee,
      refund,
      chainID: destDeposit.chainID,
      roots: [originNativeRoot, ...originNeighborRoots],
      // private
      nullifier: destDeposit.nullifier,
      secret: destDeposit.secret,
      pathElements: path_elements,
      pathIndices: path_index,
      diffs: [originNativeRoot, originNeighborRoots[0]].map(r => {
        return F.sub(
          Scalar.fromString(`${r}`),
          Scalar.fromString(`${originNeighborRoots[0]}`),
        ).toString();
      }),
    };

    wtns = await createWitness(input);

    res = await snarkjs.groth16.prove('test/fixtures/circuit_final.zkey', wtns);
    proof = res.proof;
    publicSignals = res.publicSignals;
    vKey = await snarkjs.zKey.exportVerificationKey('test/fixtures/circuit_final.zkey');
    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    assert.strictEqual(res, true);
    args = [
      helpers.createRootsBytes(input.roots),
      helpers.toFixedHex(input.nullifierHash),
      helpers.toFixedHex(input.recipient, 20),
      helpers.toFixedHex(input.relayer, 20),
      helpers.toFixedHex(input.fee),
      helpers.toFixedHex(input.refund),
    ];

    proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);
    /*
    *  sender withdraws on origin chain
    */
    await originChainToken.mint(OriginChainLinkableAnchorInstance.address, initialTokenMintAmount);
    let balanceOriginAnchorAfterDeposit = await originChainToken.balanceOf(OriginChainLinkableAnchorInstance.address);
    ({ logs } = await OriginChainLinkableAnchorInstance.withdraw
      (`0x${proofEncoded}`, ...args, { from: input.relayer, gasPrice: '0' }));
    
    let balanceOriginAnchorAfter = await originChainToken.balanceOf(OriginChainLinkableAnchorInstance.address);
    balanceOperatorAfter = await originChainToken.balanceOf(input.relayer);
    balanceReceiverAfter = await originChainToken.balanceOf(helpers.toFixedHex(recipient, 20));

    assert.strictEqual(balanceOriginAnchorAfter.toString(), balanceOriginAnchorAfterDeposit.sub(toBN(tokenDenomination)).toString());
    assert.strictEqual(balanceOperatorAfter.toString(), balanceOperatorBefore.add(feeBN).toString());
    assert.strictEqual(balanceReceiverAfter.toString(), balanceReceiverBefore.add(toBN(tokenDenomination)).sub(feeBN).toString());
    isSpent = await OriginChainLinkableAnchorInstance.isSpent(helpers.toFixedHex(input.nullifierHash));
    assert(isSpent);

    })
})

