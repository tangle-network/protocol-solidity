const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');
const helpers = require('../helpers');
const { toBN } = require('web3-utils')
const assert = require('assert');
const BridgeContract = artifacts.require('Bridge');
const Anchor = artifacts.require('FixedDepositAnchor');
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

contract('E2E LinkableAnchors - Cross chain withdraw using historical root should work', async accounts => {
  const relayerThreshold = 1;
  // Note: we have to use the same chainID for tests since Hardhat can't simulate 2 networks
  const originChainID = 31337;
  const destChainID = 31337;
  const relayer1Address = accounts[3];
  const operator = accounts[6];
  const initialTokenMintAmount = BigInt(1e25);
  const tokenDenomination = '1000000000000000000000';
  const merkleTreeHeight = 30;
  const sender = accounts[5];
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
  const refund = BigInt((new BN('0')).toString());
  const recipient = helpers.getRandomRecipient();

  let originMerkleRoot;
  let originUpdateNonce;
  let v2, v3, v4, v5, v6;
  let hasher, verifier;
  let originChainToken;
  let destChainToken;
  let originDeposit; 
  let tree;
  let createWitness;
  let OriginChainAnchorInstance;
  let originUpdateData;
  let originUpdateDataHash;
  let resourceID;
  let initialResourceIDs;
  let DestBridgeInstance;
  let DestChainAnchorInstance
  let DestAnchorHandlerInstance;
  let destInitialContractAddresses;

  const MAX_EDGES = 1;

  beforeEach(async () => {
    await Promise.all([
      // instantiate bridges on dest chain side
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
      sender,
      originChainToken.address,
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      MAX_EDGES,
    { from: sender });
    DestChainAnchorInstance = await Anchor.new(
      sender,
      destChainToken.address,
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      MAX_EDGES,
    { from: sender });
    // create resource ID using anchor address
    resourceID = helpers.createResourceID(OriginChainAnchorInstance.address, 0);
    initialResourceIDs = [resourceID];
    destInitialContractAddresses = [OriginChainAnchorInstance.address];
    // initialize anchorHanders 
    await Promise.all([
      AnchorHandlerContract.new(DestBridgeInstance.address, initialResourceIDs, destInitialContractAddresses)
        .then(instance => DestAnchorHandlerInstance = instance),
    ]);
    // increase allowance and set resources for bridge
    await DestBridgeInstance.adminSetResource(DestAnchorHandlerInstance.address, resourceID, DestChainAnchorInstance.address)
     // set bridge and handler permissions for anchor
    await Promise.all([
      DestChainAnchorInstance.setHandler(DestAnchorHandlerInstance.address, { from: sender }),
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

  it('[sanity] dest chain bridge configured with threshold and relayers', async () => {
    assert.equal(await DestBridgeInstance._chainID(), destChainID)
    assert.equal(await DestBridgeInstance._relayerThreshold(), relayerThreshold)
    assert.equal((await DestBridgeInstance._totalRelayers()).toString(), '1')
  })

  it('withdrawing across bridge after two deposits should work', async () => {
    /*
    * sender deposits on origin chain anchor
    */
    // minting Tokens
    await originChainToken.mint(sender, initialTokenMintAmount);
    //increase allowance
    originChainToken.approve(OriginChainAnchorInstance.address, initialTokenMintAmount, { from: sender });
    // deposit on both chains and define nonces based on events emmited
    let firstOriginDeposit = helpers.generateDeposit(destChainID);
    let { logs } = await OriginChainAnchorInstance.deposit(
      helpers.toFixedHex(firstOriginDeposit.commitment), { from: sender });
    let latestLeafIndex = logs[0].args.leafIndex;
    originUpdateNonce = latestLeafIndex;
    firstWithdrawlMerkleRoot = await OriginChainAnchorInstance.getLastRoot();
    // create correct update proposal data for the deposit on origin chain
    originUpdateData = helpers.createUpdateProposalData(originChainID, latestLeafIndex, firstWithdrawlMerkleRoot, DestChainAnchorInstance.address, destChainID);
    originUpdateDataHash = Ethers.utils.keccak256(DestAnchorHandlerInstance.address + originUpdateData.substr(2));

    // deposit on origin chain leads to update addEdge proposal on dest chain
    // relayer1 creates the deposit proposal for the deposit that occured in the before each loop
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
    /*
    *  sender generate proof
    */
    // insert two commitments into the tree
    await tree.insert(firstOriginDeposit.commitment);
  
    let { pathElements, pathIndices } = await tree.path(0);

    const destNativeRoot = await DestChainAnchorInstance.getLastRoot();
    const firstWithdrawalNeighborRoots = await DestChainAnchorInstance.getLatestNeighborRoots();
    let input = {
      // public
      nullifierHash: firstOriginDeposit.nullifierHash,
      refreshCommitment: 0,
      recipient,
      relayer: operator,
      fee,
      refund,
      chainID: firstOriginDeposit.chainID,
      roots: [destNativeRoot, ...firstWithdrawalNeighborRoots],
      // private
      nullifier: firstOriginDeposit.nullifier,
      secret: firstOriginDeposit.secret,
      pathElements,
      pathIndices,
      diffs: [destNativeRoot, firstWithdrawalNeighborRoots[0]].map(r => {
        return F.sub(
          Scalar.fromString(`${r}`),
          Scalar.fromString(`${firstWithdrawalNeighborRoots[0]}`),
        ).toString();
      }),
    };

    let wtns = await createWitness(input);

    let res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey', wtns);
    proof = res.proof;
    publicSignals = res.publicSignals;

    // Uncomment to measure gas usage
    // gas = await anchor.withdraw.estimateGas(proof, publicSignals, { from: relayer, gasPrice: '100' })
    // console.log('withdraw gas:', gas)
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
    *  sender's second deposit on origin chain anchor
    */
    // deposit on origin chain and define nonce based on events emmited
    originDeposit = helpers.generateDeposit(destChainID, 30);
    ({ logs } = await OriginChainAnchorInstance.deposit(helpers.toFixedHex(originDeposit.commitment), { from: sender }));
    latestLeafIndex = logs[0].args.leafIndex;
    originUpdateNonce = latestLeafIndex;
    secondWithdrawalMerkleRoot = await OriginChainAnchorInstance.getLastRoot();
    // create correct update proposal data for the deposit on origin chain
    originUpdateData = helpers.createUpdateProposalData(originChainID, latestLeafIndex, secondWithdrawalMerkleRoot, DestChainAnchorInstance.address, destChainID);
    originUpdateDataHash = Ethers.utils.keccak256(DestAnchorHandlerInstance.address + originUpdateData.substr(2));
    /*
    * Relayers vote on dest chain
    */
    // a second deposit on origin chain leads to update edge proposal on dest chain
    // relayer1 creates the deposit proposal for the deposit that occured in the before each loop
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
    *  sender withdraws using first commitment
    */
    // mint to anchor and track balance
    await destChainToken.mint(DestChainAnchorInstance.address, initialTokenMintAmount);
    let balanceDestAnchorAfterDeposits = await destChainToken.balanceOf(DestChainAnchorInstance.address);
    // withdraw
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
    assert.strictEqual(balanceDestAnchorAfter.toString(), balanceDestAnchorAfterDeposits.sub(toBN(tokenDenomination)).toString());
    assert.strictEqual(balanceOperatorAfter.toString(), balanceOperatorBefore.add(feeBN).toString());
    assert.strictEqual(balanceReceiverAfter.toString(), balanceReceiverBefore.add(toBN(tokenDenomination)).sub(feeBN).toString());
    isSpent = await DestChainAnchorInstance.isSpent(helpers.toFixedHex(input.nullifierHash));
    assert(isSpent);

    /*
    *  generate proof for second deposit
    */
    // insert second deposit in tree and get path for withdrawal proof
    await tree.insert(originDeposit.commitment);
    ({ root, pathElements, pathIndices } = await tree.path(1));
    const secondWithdrawalNeighborRoots = await DestChainAnchorInstance.getLatestNeighborRoots();
    input = {
      // public
      nullifierHash: originDeposit.nullifierHash,
      refreshCommitment: 0,
      recipient,
      relayer: operator,
      fee,
      refund,
      chainID: originDeposit.chainID,
      roots: [destNativeRoot, ...secondWithdrawalNeighborRoots],
      // private
      nullifier: originDeposit.nullifier,
      secret: originDeposit.secret,
      pathElements,
      pathIndices,
      diffs: [destNativeRoot, secondWithdrawalNeighborRoots[0]].map(r => {
        return F.sub(
          Scalar.fromString(`${r}`),
          Scalar.fromString(`${secondWithdrawalNeighborRoots[0]}`),
        ).toString();
      }),
    };

    wtns = await createWitness(input);

    res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey', wtns);
    proof = res.proof;
    publicSignals = res.publicSignals;
    vKey = await snarkjs.zKey.exportVerificationKey('protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey');
    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    assert.strictEqual(res, true);

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
    *  create 30 new deposits on chain so history wraps around and forgets second deposit
    */
    for (var i = 0; i < 30; i++) {
      // deposit on origin chain and define nonce based on events emmited
      originDeposit = helpers.generateDeposit(destChainID, i);
      ({ logs } = await OriginChainAnchorInstance.deposit(helpers.toFixedHex(originDeposit.commitment), { from: sender }));
      latestLeafIndex = logs[0].args.leafIndex;
      originUpdateNonce = latestLeafIndex;
      originMerkleRoot = await OriginChainAnchorInstance.getLastRoot();
      // create correct update proposal data for the deposit on origin chain
      originUpdateData = helpers.createUpdateProposalData(originChainID, latestLeafIndex, originMerkleRoot, DestChainAnchorInstance.address, destChainID);
      originUpdateDataHash = Ethers.utils.keccak256(DestAnchorHandlerInstance.address + originUpdateData.substr(2));
      /*
      * Relayers vote on dest chain
      */
      // relayer1 creates the deposit proposal for the deposit that occured in the before each loop
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
    }

    // withdraw should revert as historical root does not exist
    await TruffleAssert.reverts(DestChainAnchorInstance.withdraw(`0x${proofEncoded}`, {
      _roots: args[0],
      _nullifierHash: args[1],
      _refreshCommitment: args[2],
      _recipient: args[3],
      _relayer: args[4],
      _fee: args[5],
      _refund: args[6],
    }, { from: input.relayer }),
      'Neighbor root not found');
  }).timeout(0);      
})
