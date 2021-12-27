const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');
const helpers = require('../helpers');
const { toBN } = require('web3-utils')
const assert = require('assert');
const BridgeContract = artifacts.require('Bridge');
const Anchor = artifacts.require('Anchor');
const Hasher = artifacts.require('PoseidonT3');
const Verifier = artifacts.require('Verifier');
const Verifier2 = artifacts.require('Verifier2');
const Verifier3 = artifacts.require('Verifier3');
const Verifier4 = artifacts.require('Verifier4');
const Verifier5 = artifacts.require('Verifier5');
const Verifier6 = artifacts.require('Verifier6');
const Token = artifacts.require('ERC20Mock');
const AnchorHandlerContract = artifacts.require('AnchorHandler');

const fs = require('fs')
const path = require('path');
const { NATIVE_AMOUNT } = process.env
let prefix = 'poseidon-test'
const snarkjs = require('snarkjs');
const BN = require('bn.js');
const F = require('circomlibjs').babyjub.F;
const Scalar = require('ffjavascript').Scalar;
const MerkleTree = require('../../packages/fixed-bridge/src').MerkleTree;

contract('E2E LinkableAnchors - Simple cross chain withdrawals', async accounts => {
  const relayerThreshold = 1;
  // Note: we have to use the same chainID for tests since Hardhat can't simulate 2 networks
  const originChainID = 31337;
  const destChainID = 31337;
  const relayer1Address = accounts[3];
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
  let originUpdateNonce;
  let destUpdateNonce;
  let v2, v3, v4, v5, v6;
  let hasher, verifier;
  let originChainToken;
  let destChainToken;
  let originDeposit;
  let destDeposit;
  let tree;
  let createWitness;
  let OriginBridgeInstance;
  let OriginChainAnchorInstance;
  let OriginAnchorHandlerInstance;
  let originUpdateData;
  let originUpdateDataHash;
  let resourceID;
  let initialResourceIDs;
  let originInitialContractAddresses;
  let DestBridgeInstance;
  let DestChainAnchorInstance
  let DestAnchorHandlerInstance;
  let destUpdateData;
  let destUpdateDataHash;
  let destInitialContractAddresses;

  const MAX_EDGES = 1;

  beforeEach(async () => {
    await Promise.all([
      // instantiate bridges on both sides
      BridgeContract.new(originChainID, [relayer1Address], relayerThreshold, 0, 100).then(instance => OriginBridgeInstance = instance),
      BridgeContract.new(destChainID, [relayer1Address], relayerThreshold, 0, 100).then(instance => DestBridgeInstance = instance),
      // create hasher, verifier, and tokens
      Hasher.new().then(instance => hasher = instance),
      Verifier2.new().then(instance => v2 = instance),
      Verifier3.new().then(instance => v3 = instance),
      Verifier4.new().then(instance => v4 = instance),
      Verifier5.new().then(instance => v5 = instance),
      Verifier6.new().then(instance => v6 = instance),
      Token.new().then(instance => originChainToken = instance),
      Token.new().then(instance => destChainToken = instance),
    ]);
    verifier = await Verifier.new(
      v2.address,
      v3.address,
      v4.address,
      v5.address,
      v6.address
    );

    // initialize anchors on both chains
    OriginChainAnchorInstance = await Anchor.new(
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      originChainToken.address,
      sender,
      sender,
      sender,
      MAX_EDGES,
    { from: sender });
    DestChainAnchorInstance = await Anchor.new(
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      destChainToken.address,
      sender,
      sender,
      sender,
      MAX_EDGES,
    { from: sender });
    // create resource ID using anchor address
    resourceID = helpers.createResourceID(OriginChainAnchorInstance.address, 0);
    initialResourceIDs = [resourceID];
    originInitialContractAddresses = [DestChainAnchorInstance.address];
    destInitialContractAddresses = [OriginChainAnchorInstance.address];
    // initialize anchorHanders 
    await Promise.all([
      AnchorHandlerContract.new(OriginBridgeInstance.address, initialResourceIDs, originInitialContractAddresses)
        .then(instance => OriginAnchorHandlerInstance = instance),
      AnchorHandlerContract.new(DestBridgeInstance.address, initialResourceIDs, destInitialContractAddresses)
        .then(instance => DestAnchorHandlerInstance = instance),
    ]);
    // increase allowance and set resources for bridge
    await Promise.all([
      OriginBridgeInstance.adminSetResource(OriginAnchorHandlerInstance.address, resourceID, OriginChainAnchorInstance.address),
      DestBridgeInstance.adminSetResource(DestAnchorHandlerInstance.address, resourceID, DestChainAnchorInstance.address)
    ]);
     // set bridge and handler permissions for anchors
    await Promise.all([
      OriginChainAnchorInstance.setHandler(OriginAnchorHandlerInstance.address, {from: sender}),
      OriginChainAnchorInstance.setBridge(OriginBridgeInstance.address, {from: sender}),
      DestChainAnchorInstance.setHandler(DestAnchorHandlerInstance.address, {from: sender}),
      DestChainAnchorInstance.setBridge(DestBridgeInstance.address, {from: sender})
    ]);

    createWitness = async (data) => {
      const witnessCalculator = require("../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js");
      const fileBuf = require('fs').readFileSync('./protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm');
      const wtnsCalc = await witnessCalculator(fileBuf)
      const wtns = await wtnsCalc.calculateWTNSBin(data,0);
      return wtns;
    }

    tree = new MerkleTree(prefix, merkleTreeHeight)
    zkey_final = fs.readFileSync('protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey').buffer;
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
    await originChainToken.approve(OriginChainAnchorInstance.address, initialTokenMintAmount, { from: sender });
    // generate deposit commitment targeting withdrawal on destination chain
    originDeposit = helpers.generateDeposit(destChainID);
    // deposit on origin chain and define nonce
    let { logs } = await OriginChainAnchorInstance.deposit(helpers.toFixedHex(originDeposit.commitment), { from: sender });
    let latestLeafIndex = logs[0].args.leafIndex;
    originUpdateNonce = latestLeafIndex;
    originMerkleRoot = await OriginChainAnchorInstance.getLastRoot();
    // create correct update proposal data for the deposit on origin chain
    originUpdateData = helpers.createUpdateProposalData(originChainID, latestLeafIndex, originMerkleRoot, DestChainAnchorInstance.address, destChainID);
    originUpdateDataHash = Ethers.utils.keccak256(DestAnchorHandlerInstance.address + originUpdateData.substr(2));
    /*
    *  Relayers vote on dest chain
    */
    // deposit on origin chain leads to update proposal on dest chain
    // relayer1 creates the deposit proposal for the deposit
    await TruffleAssert.passes(DestBridgeInstance.voteProposal(
      originChainID,
      originUpdateNonce,
      resourceID,
      originUpdateDataHash,
      { from: relayer1Address }
    ));
    // relayer1 will execute the deposit proposal
    await TruffleAssert.passes(DestBridgeInstance.executeProposal(
      originChainID,
      originUpdateNonce,
      originUpdateData,
      resourceID,
      { from: relayer1Address }
    ));

    // check initial balances before withdrawal
    let balanceOperatorBefore = await destChainToken.balanceOf(operator);
    let balanceReceiverBefore = await destChainToken.balanceOf(helpers.toFixedHex(recipient, 20));
    /*
    *  sender generates proof
    */
    const destNeighborRoots = await DestChainAnchorInstance.getLatestNeighborRoots();
    await tree.insert(originDeposit.commitment);

    let { pathElements, pathIndices } = await tree.path(0);
    const destNativeRoot = await DestChainAnchorInstance.getLastRoot();
    let input = {
      // public
      nullifierHash: originDeposit.nullifierHash,
      refreshCommitment: 0,
      recipient,
      relayer: operator,
      fee,
      refund,
      chainID: originDeposit.chainID,
      roots: [destNativeRoot, ...destNeighborRoots],
      // private
      nullifier: originDeposit.nullifier,
      secret: originDeposit.secret,
      pathElements,
      pathIndices,
      diffs: [destNativeRoot, ...destNeighborRoots].map(r => {
        return F.sub(
          Scalar.fromString(`${r}`),
          Scalar.fromString(`${destNeighborRoots[0]}`),
        ).toString();
      }),
    };

    let wtns = await createWitness(input);

    let res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey', wtns);
    proof = res.proof;
    publicSignals = res.publicSignals;

    let args = [
      helpers.createRootsBytes(input.roots),
      helpers.toFixedHex(input.nullifierHash),
      helpers.toFixedHex(input.refreshCommitment),
      helpers.toFixedHex(input.recipient, 20),
      helpers.toFixedHex(input.relayer, 20),
      helpers.toFixedHex(input.fee),
      helpers.toFixedHex(input.refund),
    ];

    let proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);
    /*
    *  sender withdraws on dest chain
    */
    await destChainToken.mint(DestChainAnchorInstance.address, initialTokenMintAmount);
    let balanceDestAnchorAfterDeposit = await destChainToken.balanceOf(DestChainAnchorInstance.address);
    ({ logs } = await DestChainAnchorInstance.withdraw(`0x${proofEncoded}`, {
      _roots: args[0],
      _nullifierHash: args[1],
      _refreshCommitment: args[2],
      _recipient: args[3],
      _relayer: args[4],
      _fee: args[5],
      _refund: args[6],
    }, { from: input.relayer }));
    
    let balanceDestAnchorAfter = await destChainToken.balanceOf(DestChainAnchorInstance.address);
    let balanceOperatorAfter = await destChainToken.balanceOf(input.relayer);
    let balanceReceiverAfter = await destChainToken.balanceOf(helpers.toFixedHex(recipient, 20));
    const feeBN = toBN(fee.toString())
    assert.strictEqual(balanceDestAnchorAfter.toString(), balanceDestAnchorAfterDeposit.sub(toBN(tokenDenomination)).toString());
    assert.strictEqual(balanceOperatorAfter.toString(), balanceOperatorBefore.add(feeBN).toString());
    assert.strictEqual(balanceReceiverAfter.toString(), balanceReceiverBefore.add(toBN(tokenDenomination)).sub(feeBN).toString());

    isSpent = await DestChainAnchorInstance.isSpent(helpers.toFixedHex(input.nullifierHash));
    assert(isSpent);
    /*
    *  sender deposit on dest chain
    */
    // minting Tokens
    await destChainToken.mint(sender, initialTokenMintAmount);
    // approval
    await destChainToken.approve(DestChainAnchorInstance.address, initialTokenMintAmount, { from: sender }),
    // generate deposit commitment
    destDeposit = helpers.generateDeposit(originChainID);
    // deposit on dest chain and define nonce
    ({ logs } = await DestChainAnchorInstance.deposit(helpers.toFixedHex(destDeposit.commitment), {from: sender}));
    latestLeafIndex = logs[0].args.leafIndex;
    destUpdateNonce = latestLeafIndex;
    destMerkleRoot = await DestChainAnchorInstance.getLastRoot();
    // create correct update proposal data for the deposit on dest chain
    destUpdateData = helpers.createUpdateProposalData(destChainID, latestLeafIndex, destMerkleRoot, OriginChainAnchorInstance.address, originChainID);
    destUpdateDataHash = Ethers.utils.keccak256(OriginAnchorHandlerInstance.address + destUpdateData.substr(2));
    /*
    *  relayers vote on origin chain
    */
    // deposit on dest chain leads to update proposal on origin chain
    // relayer1 creates the deposit proposal
    await TruffleAssert.passes(OriginBridgeInstance.voteProposal(
      destChainID,
      destUpdateNonce,
      resourceID,
      destUpdateDataHash,
      { from: relayer1Address }
    ));
    // relayer1 will execute the update proposal
    await TruffleAssert.passes(OriginBridgeInstance.executeProposal(
      destChainID,
      destUpdateNonce,
      destUpdateData,
      resourceID,
      { from: relayer1Address }
    ));
    const originNeighborRoots = await OriginChainAnchorInstance.getLatestNeighborRoots();
    assert.strictEqual(originNeighborRoots.length, maxRoots);
    assert.strictEqual(originNeighborRoots[0], destMerkleRoot);
    // check initial balances
    balanceOperatorBefore = await originChainToken.balanceOf(operator);
    balanceReceiverBefore = await originChainToken.balanceOf(helpers.toFixedHex(recipient, 20));
    /*
    *  sender generates proof
    */
    tree = new MerkleTree(prefix, merkleTreeHeight)  
    await tree.insert(destDeposit.commitment);

    ({ merkleRoot, pathElements, pathIndices } = await tree.path(0));
    const originNativeRoot = await OriginChainAnchorInstance.getLastRoot();
    input = {
      // public
      nullifierHash: destDeposit.nullifierHash,
      refreshCommitment: 0,
      recipient,
      relayer: operator,
      fee,
      refund,
      chainID: destDeposit.chainID,
      roots: [originNativeRoot, ...originNeighborRoots],
      // private
      nullifier: destDeposit.nullifier,
      secret: destDeposit.secret,
      pathElements,
      pathIndices,
      diffs: [originNativeRoot, originNeighborRoots[0]].map(r => {
        return F.sub(
          Scalar.fromString(`${r}`),
          Scalar.fromString(`${originNeighborRoots[0]}`),
        ).toString();
      }),
    };

    wtns = await createWitness(input);

    res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey', wtns);
    proof = res.proof;
    publicSignals = res.publicSignals;

    args = [
      helpers.createRootsBytes(input.roots),
      helpers.toFixedHex(input.nullifierHash),
      helpers.toFixedHex(input.refreshCommitment),
      helpers.toFixedHex(input.recipient, 20),
      helpers.toFixedHex(input.relayer, 20),
      helpers.toFixedHex(input.fee),
      helpers.toFixedHex(input.refund),
    ];

    proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);
    /*
    *  sender withdraws on origin chain
    */
    await originChainToken.mint(OriginChainAnchorInstance.address, initialTokenMintAmount);
    let balanceOriginAnchorAfterDeposit = await originChainToken.balanceOf(OriginChainAnchorInstance.address);
    ({ logs } = await OriginChainAnchorInstance.withdraw(`0x${proofEncoded}`, {
      _roots: args[0],
      _nullifierHash: args[1],
      _refreshCommitment: args[2],
      _recipient: args[3],
      _relayer: args[4],
      _fee: args[5],
      _refund: args[6],
    }, { from: input.relayer }));
    
    let balanceOriginAnchorAfter = await originChainToken.balanceOf(OriginChainAnchorInstance.address);
    balanceOperatorAfter = await originChainToken.balanceOf(input.relayer);
    balanceReceiverAfter = await originChainToken.balanceOf(helpers.toFixedHex(recipient, 20));

    assert.strictEqual(balanceOriginAnchorAfter.toString(), balanceOriginAnchorAfterDeposit.sub(toBN(tokenDenomination)).toString());
    assert.strictEqual(balanceOperatorAfter.toString(), balanceOperatorBefore.add(feeBN).toString());
    assert.strictEqual(balanceReceiverAfter.toString(), balanceReceiverBefore.add(toBN(tokenDenomination)).sub(feeBN).toString());
    isSpent = await OriginChainAnchorInstance.isSpent(helpers.toFixedHex(input.nullifierHash));
    assert(isSpent);

    })
})

