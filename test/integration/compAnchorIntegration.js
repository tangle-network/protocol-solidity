const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');
const helpers = require('../helpers');
const { toBN } = require('web3-utils')
const assert = require('assert');
const BridgeContract = artifacts.require('Bridge');
const Anchor = artifacts.require('./Anchor2.sol');
const Verifier = artifacts.require('./VerifierPoseidonBridge.sol');
const Hasher = artifacts.require('PoseidonT3');
const Token = artifacts.require('ERC20Mock');
const CompToken = artifacts.require('CompToken')
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

const {
  etherUnsigned
} = helpers;
const { network } = require('hardhat');
const TimelockHarness = artifacts.require('TimelockHarness');
const GovernorBravoImmutable = artifacts.require('GovernorBravoImmutable');
const GovernedTokenWrapper = artifacts.require('GovernedTokenWrapper');
const solparse = require('solparse');

const governorBravoPath = path.join(__dirname, '../../', 'contracts', 'governance/GovernorBravoInterfaces.sol');
const statesInverted = solparse
  .parseFile(governorBravoPath)
  .body
  .find(k => k.name === 'GovernorBravoDelegateStorageV1')
  .body
  .find(k => k.name == 'ProposalState')
  .members

const states = Object.entries(statesInverted).reduce((obj, [key, value]) => ({ ...obj, [value]: key }), {});


contract('E2E LinkableCompTokenAnchors - Cross chain withdrawals with gov bravo', async accounts => {
  const relayerThreshold = 1;
  const originChainID = 1;
  const destChainID = 2;
  const bravoAdmin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const relayer1Address = accounts[3];
  const sender = accounts[5];
  const operator = accounts[6];
  const initialTokenMintAmount = BigInt(1e25);
  const tokenDenomination = '1000000000000000000000';
  const merkleTreeHeight = 30;
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
  const refund = BigInt((new BN('0')).toString());

  let MINTER_ROLE;
  let originMerkleRoot;
  let destMerkleRoot;
  let originBlockHeight = 1;
  let destBlockHeight = 1;
  let originUpdateNonce;
  let destUpdateNonce;
  let hasher, verifier;
  let originDeposit;
  let originWrapperToken;
  let destWrapperToken;
  let destDeposit; 
  let tree;
  let createWitness;
  let OriginBridgeInstance;
  let OriginChainAnchorInstance;
  let OriginAnchorHandlerInstance;
  let originDepositData;
  let originDepositDataHash;
  let resourceID;
  let initialResourceIDs;
  let originInitialContractAddresses;
  let DestBridgeInstance;
  let DestChainAnchorInstance
  let DestAnchorHandlerInstance;
  let destDepositData;
  let destDepositDataHash;
  let destInitialContractAddresses;

  const name = 'Webb-1';
  const symbol = 'WEB1';
  let originGov;
  let destGov;
  let originWEBB;
  let destWEBB;
  let originToken;
  let destToken;

  beforeEach(async () => {
    // create tokens
    await Promise.all([ 
      Token.new().then(instance => originToken = instance),
      Token.new().then(instance => destToken = instance),
      CompToken.new('Webb', 'WEBB').then(instance => originWEBB = instance),
      CompToken.new('Webb', 'WEBB').then(instance => destWEBB = instance),
    ])
    // instantiate governed token wrappers and gov bravos 
    delay = etherUnsigned(2 * 24 * 60 * 60).multipliedBy(2)
    originTimelock = await TimelockHarness.new(bravoAdmin, delay);
    destTimelock = await TimelockHarness.new(bravoAdmin, delay);
    originGov = await GovernorBravoImmutable.new(originTimelock.address, originWEBB.address, bravoAdmin, 10, 1, '100000000000000000000000');
    destGov = await GovernorBravoImmutable.new(destTimelock.address, destWEBB.address, bravoAdmin, 10, 1, '100000000000000000000000');
    await originGov._initiate();
    await originTimelock.harnessSetAdmin(originGov.address);
    await destGov._initiate();
    await destTimelock.harnessSetAdmin(destGov.address);
    //initialize TokenWrappers
    originWrapperToken = await GovernedTokenWrapper.new(name, symbol, originTimelock.address, '1000000000000000000000000', {from: sender});
    destWrapperToken = await GovernedTokenWrapper.new(name, symbol, destTimelock.address, '1000000000000000000000000', {from: sender});
    // delegate bravoAdmin on both chains
    await originWEBB.mint(bravoAdmin, initialTokenMintAmount)
    await destWEBB.mint(bravoAdmin, initialTokenMintAmount)
    await originWEBB.delegate(bravoAdmin);
    await destWEBB.delegate(bravoAdmin);
    // instantiate bridges on both sides
    await Promise.all([
      BridgeContract.new(originChainID, [relayer1Address], relayerThreshold, 0, 100).then(instance => OriginBridgeInstance = instance),
      BridgeContract.new(destChainID, [relayer1Address], relayerThreshold, 0, 100).then(instance => DestBridgeInstance = instance),
      // create hasher, verifier, and tokens
      Hasher.new().then(instance => hasher = instance),
      Verifier.new().then(instance => verifier = instance)
    ]);
    // initialize anchors on both chains
    OriginChainAnchorInstance = await Anchor.new(
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      originChainID,
      originWrapperToken.address,
      sender,
      sender,
      sender,
    {from: sender});
    DestChainAnchorInstance = await Anchor.new(
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      destChainID,
      destWrapperToken.address,
      sender,
      sender,
      sender,
    {from: sender});
    // set Minting permissions for anchors 
    MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
    await originWrapperToken.grantRole(MINTER_ROLE, OriginChainAnchorInstance.address, {from: sender});
    await destWrapperToken.grantRole(MINTER_ROLE, DestChainAnchorInstance.address, {from: sender});
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
  
  it('Wrapping should fail if Anchor does not have MINTER_ROLE', async () => {
    //originToken is voted to be approved for token wrapper on origin chain
    await helpers.addTokenToWrapper(originGov, originWrapperToken, originToken, bravoAdmin, states);
    // revoke anchor permissions
    await originWrapperToken.revokeRole(MINTER_ROLE, OriginChainAnchorInstance.address, {from: sender});
    await originToken.mint(user1, initialTokenMintAmount);
    await originToken.approve(originWrapperToken.address, initialTokenMintAmount, {from: user1});
    await TruffleAssert.reverts(OriginChainAnchorInstance.wrap(originToken.address, tokenDenomination, {from: user1}),
      'ERC20PresetMinterPauser: must have minter role');
  })

  it('Anchor fails to mint on withdraw without MINTER_ROLE', async () => {
    //originToken is voted to be approved for token wrapper on origin chain
    await helpers.addTokenToWrapper(originGov, originWrapperToken, originToken, bravoAdmin, states);
    /*
    *  User1 wraps originToken for originWrapperToken
    */
    await originToken.mint(user1, initialTokenMintAmount);
    await originToken.approve(originWrapperToken.address, initialTokenMintAmount, {from: user1});
    await originWrapperToken.approve(OriginChainAnchorInstance.address, initialTokenMintAmount, {from: user1});
    await OriginChainAnchorInstance.wrap(originToken.address, tokenDenomination, {from: user1});
    /*
    *  User1 deposits on origin chain
    */
    // generate deposit commitment targeting withdrawal on destination chain
    originDeposit = helpers.generateDeposit(destChainID);
    // deposit on origin chain and define nonce
    let { logs } = await OriginChainAnchorInstance.deposit(helpers.toFixedHex(originDeposit.commitment), {from: user1});
    originUpdateNonce = logs[0].args.leafIndex;
    originMerkleRoot = await OriginChainAnchorInstance.getLastRoot();
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

    /*
    *  User1 generates proof
    */
    const destNeighborRoots = await DestChainAnchorInstance.getLatestNeighborRoots();
    await tree.insert(originDeposit.commitment);

    let { root, path_elements, path_index } = await tree.path(0);
    const destNativeRoot = await DestChainAnchorInstance.getLastRoot();
    let input = {
      // public
      nullifierHash: originDeposit.nullifierHash,
      recipient: user1,
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
    // revoke anchor permissions
    await destWrapperToken.revokeRole(MINTER_ROLE, DestChainAnchorInstance.address, {from: sender});
    // user1 withdraw on dest chain
    await TruffleAssert.reverts(DestChainAnchorInstance.withdraw
      (`0x${proofEncoded}`, ...args, { from: input.relayer, gasPrice: '0' }), 'ERC20PresetMinterPauser: must have minter role');
  })

  it('cross chain deposits and withdrawals should work', async () => {
    //originToken is voted to be approved for token wrapper on origin chain
    await helpers.addTokenToWrapper(originGov, originWrapperToken, originToken, bravoAdmin, states);
    /*
    *  User1 wraps originToken for originWrapperToken
    */
    await originToken.mint(user1, initialTokenMintAmount);
    // approve wrapper to transfer user1's originTokens
    await originToken.approve(originWrapperToken.address, initialTokenMintAmount, {from: user1});
    // approve anchor for deposit
    await originWrapperToken.approve(OriginChainAnchorInstance.address, initialTokenMintAmount, {from: user1});
    await OriginChainAnchorInstance.wrap(originToken.address, tokenDenomination, {from: user1});
    /*
    *  User1 deposits on origin chain
    */
    // generate deposit commitment targeting withdrawal on destination chain
    originDeposit = helpers.generateDeposit(destChainID);
    // deposit on origin chain and define nonce
    let { logs } = await OriginChainAnchorInstance.deposit(helpers.toFixedHex(originDeposit.commitment), {from: user1});
    originUpdateNonce = logs[0].args.leafIndex;
    originMerkleRoot = await OriginChainAnchorInstance.getLastRoot();
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
    // check initial balances
    let balanceOperatorBefore = await destWrapperToken.balanceOf(operator);
    let balanceReceiverBefore = await destWrapperToken.balanceOf(user1);
    // get roots for proof
    const destNeighborRoots = await DestChainAnchorInstance.getLatestNeighborRoots();
    /*
    *  User1 generates proof
    */
    await tree.insert(originDeposit.commitment);
    
    let { root, path_elements, path_index } = await tree.path(0);
    const destNativeRoot = await DestChainAnchorInstance.getLastRoot();
    let input = {
      // public
      nullifierHash: originDeposit.nullifierHash,
      recipient: user1,
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
    *  user1 withdraw on dest chain
    */
    ({ logs } = await DestChainAnchorInstance.withdraw
      (`0x${proofEncoded}`, ...args, { from: input.relayer, gasPrice: '0' }));

    let balanceDestAnchorAfter = await destWrapperToken.balanceOf(DestChainAnchorInstance.address);
    let balanceOperatorAfter = await destWrapperToken.balanceOf(input.relayer);
    let balanceUser1AfterUnwrap = await destWrapperToken.balanceOf(user1);
    const feeBN = toBN(fee.toString())
    assert.strictEqual(balanceDestAnchorAfter.toString(), toBN(0).toString());
    assert.strictEqual(balanceOperatorAfter.toString(), balanceOperatorBefore.add(feeBN).toString());
    assert.strictEqual(balanceUser1AfterUnwrap.toString(), balanceReceiverBefore.add(toBN(tokenDenomination)).sub(feeBN).toString());
    assert.strictEqual((await destWrapperToken.totalSupply()).toString(), tokenDenomination.toString());
    isSpent = await DestChainAnchorInstance.isSpent(helpers.toFixedHex(input.nullifierHash));
    assert(isSpent);

    //originToken is voted to be approved for token wrapper on origin chain
    await helpers.addTokenToWrapper(destGov, destWrapperToken, destToken, bravoAdmin, states);
    /*
    *  user2 wraps destToken for destWrapperToken
    */
    await destToken.mint(user2, initialTokenMintAmount);
    // approve tokenwrapper to transfer destTokens from user2
    await destToken.approve(destWrapperToken.address, initialTokenMintAmount, {from: user2});
    // increase allowance for user1 to burn
    await destWrapperToken.approve(DestChainAnchorInstance.address, initialTokenMintAmount, {from: user1});
    // increase allowance for user2 to deposit on destAnchor
    await destWrapperToken.approve(DestChainAnchorInstance.address, initialTokenMintAmount, {from: user2});
    await DestChainAnchorInstance.wrap(destToken.address, tokenDenomination, {from: user2});
    /*
    *  User1 unwraps destWrapperToken for destToken with new liquidity
    */
    await DestChainAnchorInstance.unwrap(destToken.address, balanceUser1AfterUnwrap, {from: user1});
    let balanceUser1AfterUnwrapUnwrap = await destToken.balanceOf(user1);
    assert.strictEqual(balanceUser1AfterUnwrapUnwrap.toString(), balanceUser1AfterUnwrap.toString());
    assert.strictEqual((await destWrapperToken.totalSupply()).toString(), toBN(tokenDenomination).add(feeBN).toString());
    /*
    *  user2 deposit on dest chain
    */
    // generate deposit commitment
    destDeposit = helpers.generateDeposit(originChainID);
    // deposit on dest chain and define nonce
    ({logs} = await DestChainAnchorInstance.deposit(helpers.toFixedHex(destDeposit.commitment), {from: user2}));
    destUpdateNonce = logs[0].args.leafIndex;
    destMerkleRoot = await DestChainAnchorInstance.getLastRoot();
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
    // check initial balances
    balanceOperatorBefore = await originWrapperToken.balanceOf(operator);
    balanceReceiverBefore = await originWrapperToken.balanceOf(user2);
    // get roots for proof
    const originNeighborRoots = await OriginChainAnchorInstance.getLatestNeighborRoots();
    /*
    *  user2 generates proof
    */
    tree = new MerkleTree(merkleTreeHeight, null, prefix)  
    await tree.insert(destDeposit.commitment);
    
    ({ root, path_elements, path_index } = await tree.path(0));
    const originNativeRoot = await OriginChainAnchorInstance.getLastRoot();
    input = {
      // public
      nullifierHash: destDeposit.nullifierHash,
      recipient: user2,
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

    isSpent = await DestChainAnchorInstance.isSpent(helpers.toFixedHex(input.nullifierHash));
    assert.strictEqual(isSpent, false);

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
    *  user1 withdraw on origin chain
    */
    let balanceOriginAnchorAfterDeposit = await originWrapperToken.balanceOf(OriginChainAnchorInstance.address);
    ({ logs } = await OriginChainAnchorInstance.withdraw
      (`0x${proofEncoded}`, ...args, { from: input.relayer, gasPrice: '0' }));
    
    let balanceOriginAnchorAfter = await originWrapperToken.balanceOf(OriginChainAnchorInstance.address);
    balanceOperatorAfter = await originWrapperToken.balanceOf(input.relayer);
    let balanceUser2AfterWithdraw = await originWrapperToken.balanceOf(user2);

    assert.strictEqual(balanceOriginAnchorAfter.toString(), toBN(0).toString());
    assert.strictEqual(balanceOperatorAfter.toString(), balanceOperatorBefore.add(feeBN).toString());
    assert.strictEqual(balanceUser2AfterWithdraw.toString(), balanceReceiverBefore.add(toBN(tokenDenomination)).sub(feeBN).toString());

    isSpent = await OriginChainAnchorInstance.isSpent(helpers.toFixedHex(input.nullifierHash));
    assert(isSpent);
    /*
    *  User2 unwraps originWrapperToken for originToken
    */
    //increase allowance for burn
    await originWrapperToken.approve(OriginChainAnchorInstance.address, initialTokenMintAmount, {from: user2});
    await OriginChainAnchorInstance.unwrap(originToken.address, balanceUser2AfterWithdraw, {from: user2});
    let balanceUser2AfterUnwrap = await originToken.balanceOf(user2);
    assert.strictEqual(balanceUser2AfterUnwrap.toString(), balanceUser2AfterUnwrap.toString());
    assert.strictEqual((await originWrapperToken.totalSupply()).toString(), feeBN.toString());
    })
})

