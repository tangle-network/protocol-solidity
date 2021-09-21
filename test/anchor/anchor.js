/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const TruffleAssert = require('truffle-assertions');
const assert = require('assert');

const fs = require('fs')
const path = require('path');
const { toBN, randomHex } = require('web3-utils')
const Anchor = artifacts.require('./Anchor2.sol');
const VerifierPoseidonBridge = artifacts.require('./VerifierPoseidonBridge.sol');
const Poseidon = artifacts.require('PoseidonT3');
const Token = artifacts.require("ERC20Mock");

const { NATIVE_AMOUNT, MERKLE_TREE_HEIGHT } = process.env
const snarkjs = require('snarkjs')
const bigInt = require('big-integer');
const BN = require('bn.js');
const F = require('circomlib').babyJub.F;
const Scalar = require("ffjavascript").Scalar;
const helpers = require('../helpers');

const MerkleTree = require('../../lib/MerkleTree');

contract('Anchor2', (accounts) => {
  let anchor
  const sender = accounts[0]
  const operator = accounts[0]
  const levels = MERKLE_TREE_HEIGHT || 30
  const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
  let prefix = 'poseidon-test'
  let tree
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString())
  const refund = BigInt((new BN('0')).toString())
  const recipient = helpers.getRandomRecipient()
  const relayer = accounts[1]
  let verifier;
  let tokenDenomination = '1000000000000000000' // 1 ether
  const chainID = 31337;

  let createWitness;

  beforeEach(async () => {
    tree = new MerkleTree(levels, null, prefix)
    hasherInstance = await Poseidon.new();
    verifier = await VerifierPoseidonBridge.new();
    token = await Token.new();
    await token.mint(sender, new BN('10000000000000000000000'));
    const balanceOfSender = await token.balanceOf.call(sender);
    anchor = await Anchor.new(
      verifier.address,
      hasherInstance.address,
      tokenDenomination,
      levels,
      token.address,
      sender,
      sender,
      sender,
    );

    setHandler = (handler, _sender) => AnchorInstance.setHandler(handler, {
      from: _sender
    });

    setBridge = (bridge, _sender) => AnchorInstance.setBridge(bridge, {
      from: _sender
    });

    addEdge = (edge, _sender) => AnchorInstance.addEdge(
      edge.destChainID,
      edge.destResourceID,
      edge.root,
      edge.height,
      { from: _sender }
    )

    updateEdge = (edge, _sender) => AnchorInstance.updateEdge(
      edge.destChainID,
      edge.destResourceID,
      edge.root,
      edge.height,
      { from: _sender }
    )

    createWitness = async (data) => {
      const wtns = {type: "mem"};
      await snarkjs.wtns.calculate(data, path.join(
        "test",
        "fixtures",
        "poseidon_bridge_2.wasm"
      ), wtns);
      return wtns;
    }

    tree = new MerkleTree(levels, null, prefix)
    zkey_final = fs.readFileSync('test/fixtures/circuit_final.zkey').buffer;
  })

  describe('#constructor', () => {
    it('should initialize', async () => {
      const etherDenomination = await anchor.denomination()
      assert.strictEqual(etherDenomination.toString(), toBN(value).toString());
    });
  })

  describe('#deposit', () => {
    it('should emit event', async () => {
      let commitment = helpers.toFixedHex(42);
      await token.approve(anchor.address, tokenDenomination)
      let { logs } = await anchor.deposit(commitment, { from: sender })

      assert.strictEqual(logs[0].event, 'Deposit')
      assert.strictEqual(logs[0].args.commitment, commitment)
      assert.strictEqual(logs[0].args.leafIndex.toString(), '0');

      const anchorBalance = await token.balanceOf.call(anchor.address);
      assert.strictEqual(anchorBalance.toString(), toBN(tokenDenomination).toString());
    })

    it('should throw if there is a such commitment', async () => {
      const commitment = helpers.toFixedHex(42)
      await token.approve(anchor.address, tokenDenomination)
      await TruffleAssert.passes(anchor.deposit(commitment, { from: sender }));
      await TruffleAssert.reverts(
        anchor.deposit(commitment, { from: sender }),
        'The commitment has been submitted'
      );
    })
  })

  // Use Node version >=12
  describe('snark proof verification on js side', () => {
    it('should detect tampering', async () => {
      const deposit = helpers.generateDeposit(chainID);
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

      let res = await snarkjs.groth16.prove('test/fixtures/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;
      let tempProof = proof;
      let tempSignals = publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('test/fixtures/circuit_final.zkey');

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
    })
  })

  describe('#withdraw', () => {
    it('should work', async () => {
      const deposit = helpers.generateDeposit(chainID);
      const user = accounts[4]
      await tree.insert(deposit.commitment)

      await token.mint(user, tokenDenomination);
      const balanceUserBefore = await token.balanceOf(user);
      const balanceAnchorBefore = await token.balanceOf(anchor.address);
      // console.log('balanceUserBefore: ', balanceUserBefore.toString());
      // console.log('balanceAnchorBefore: ', balanceAnchorBefore.toString());
      // Uncomment to measure gas usage
      // let gas = await anchor.deposit.estimateGas(toBN(deposit.commitment.toString()), { value, from: user })
      // console.log('deposit gas:', gas)
      await TruffleAssert.passes(token.approve(anchor.address, tokenDenomination, { from: user }));
      await TruffleAssert.passes(anchor.deposit(helpers.toFixedHex(deposit.commitment), { from: user }));
      const balanceUserAfterDeposit = await token.balanceOf(user)
      const balanceAnchorAfterDeposit = await token.balanceOf(anchor.address);
      // console.log('balanceUserAfterDeposit: ', balanceUserAfterDeposit.toString());
      // console.log('balanceAnchorAfterDeposit: ', balanceAnchorAfterDeposit.toString());
      assert.strictEqual(balanceUserAfterDeposit.toString(), BN(toBN(balanceUserBefore).sub(toBN(value))).toString());
      assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());

      const { root, path_elements, path_index } = await tree.path(0)

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        recipient,
        relayer: operator,
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

      let res = await snarkjs.groth16.prove('test/fixtures/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('test/fixtures/circuit_final.zkey');
      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, true);

      const balanceRelayerBefore = await token.balanceOf(relayer)
      const balanceOperatorBefore = await token.balanceOf(operator)
      const balanceReceiverBefore = await token.balanceOf(helpers.toFixedHex(recipient, 20))

      let isSpent = await anchor.isSpent(helpers.toFixedHex(input.nullifierHash))
      assert.strictEqual(isSpent, false)

      // Uncomment to measure gas usage
      // gas = await anchor.withdraw.estimateGas(proof, publicSignals, { from: relayer, gasPrice: '0' })
      // console.log('withdraw gas:', gas)
      const args = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];

      proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);
      const { logs } = await anchor.withdraw(`0x${proofEncoded}`, ...args, { from: relayer, gasPrice: '0' });
      const balanceAnchorAfter = await token.balanceOf(anchor.address)
      const balanceRelayerAfter = await token.balanceOf(relayer)
      const balanceOperatorAfter = await token.balanceOf(operator)
      const balanceReceiverAfter = await token.balanceOf(helpers.toFixedHex(recipient, 20))
      const feeBN = toBN(fee.toString())
      // console.log('balanceAnchorAfter: ', balanceAnchorAfter.toString());
      // console.log('balanceRelayerAfter: ', balanceRelayerAfter.toString());
      // console.log('balanceOperatorAfter: ', balanceOperatorAfter.toString());
      // console.log('balanceReceiverAfter: ', balanceReceiverAfter.toString());
      // console.log('feeBN: ', feeBN.toString());
      assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
      assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).toString())
      assert.strictEqual(balanceOperatorAfter.toString(), toBN(balanceOperatorBefore).add(feeBN).toString())
      assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())

      assert.strictEqual(logs[0].event, 'Withdrawal')
      assert.strictEqual(logs[0].args.nullifierHash, helpers.toFixedHex(input.nullifierHash))
      assert.strictEqual(logs[0].args.relayer, operator);
      assert.strictEqual(logs[0].args.fee.toString(), feeBN.toString());
      isSpent = await anchor.isSpent(helpers.toFixedHex(input.nullifierHash))
      assert(isSpent);
    })

    it('should prevent double spend', async () => {
      const deposit = helpers.generateDeposit(chainID);
      await tree.insert(deposit.commitment);
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(helpers.toFixedHex(deposit.commitment), { from: sender });

      const { root, path_elements, path_index } = await tree.path(0);

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        recipient,
        relayer: operator,
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

      let res = await snarkjs.groth16.prove('test/fixtures/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];

      proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);

      await TruffleAssert.passes(anchor.withdraw(`0x${proofEncoded}`, ...args, { from: relayer, gasPrice: '0' }));
      await TruffleAssert.reverts(
        anchor.withdraw(`0x${proofEncoded}`, ...args, { from: relayer, gasPrice: '0' }),
        "The note has been already spent"
      );
    })

    it('should prevent double spend with overflow', async () => {
      const deposit = helpers.generateDeposit(chainID)
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(helpers.toFixedHex(deposit.commitment), { from: sender })

      const { root, path_elements, path_index } = await tree.path(0)

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

      let res = await snarkjs.groth16.prove('test/fixtures/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(
          toBN(input.nullifierHash).add(
            toBN('21888242871839275222246405745257275088548364400416034343698204186575808495617'),
          ),
        ),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];

      proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);

      await TruffleAssert.reverts(
        anchor.withdraw(`0x${proofEncoded}`, ...args, { from: relayer, gasPrice: '0' }),
        "verifier-gte-snark-scalar-field"
      );
    })

    it('fee should be less or equal transfer value', async () => {
      const deposit = helpers.generateDeposit(chainID)
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(helpers.toFixedHex(deposit.commitment), { from: sender })

      const { root, path_elements, path_index } = await tree.path(0)
      const largeFee = bigInt(value).add(bigInt(1))

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        recipient,
        relayer,
        fee: largeFee,
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

      let res = await snarkjs.groth16.prove('test/fixtures/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ]

      proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);

      await TruffleAssert.reverts(
        anchor.withdraw(`0x${proofEncoded}`, ...args, { from: relayer, gasPrice: '0' }),
        "Fee exceeds transfer value"
      );
    })

    it('should throw for corrupted merkle tree root', async () => {
      const deposit = helpers.generateDeposit(chainID)
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(helpers.toFixedHex(deposit.commitment), { from: sender })

      const { root, path_elements, path_index } = await tree.path(0)

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

      let res = await snarkjs.groth16.prove('test/fixtures/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        helpers.createRootsBytes([randomHex(32), 0]),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ]

      proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);

      await TruffleAssert.reverts(
        anchor.withdraw(`0x${proofEncoded}`, ...args, { from: relayer, gasPrice: '0' }),
        "Cannot find your merkle root"
      );
    })

    it('should reject with tampered public inputs', async () => {
      const deposit = helpers.generateDeposit(chainID)
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(helpers.toFixedHex(deposit.commitment), { from: sender })

      let { root, path_elements, path_index } = await tree.path(0)

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

      let res = await snarkjs.groth16.prove('test/fixtures/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ]

      // recipient
      incorrectArgs = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];

      proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);
      await TruffleAssert.reverts(
        anchor.withdraw(`0x${proofEncoded}`, ...incorrectArgs, { from: relayer, gasPrice: '0' }),
        "Invalid withdraw proof"
      );

      // fee
      incorrectArgs = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex('0x000000000000000000000000000000000000000000000000015345785d8a0000'),
        helpers.toFixedHex(input.refund),
      ];
      await TruffleAssert.reverts(
        anchor.withdraw(`0x${proofEncoded}`, ...incorrectArgs, { from: relayer, gasPrice: '0' }),
        "Invalid withdraw proof"
      );

      // nullifier
      incorrectArgs = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex('0x00abdfc78211f8807b9c6504a6e537e71b8788b2f529a95f1399ce124a8642ad'),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];
      await TruffleAssert.reverts(
        anchor.withdraw(`0x${proofEncoded}`, ...incorrectArgs, { from: relayer, gasPrice: '0' }),
        "Invalid withdraw proof"
      );

      // should work with original values
      await TruffleAssert.passes(anchor.withdraw(`0x${proofEncoded}`, ...args, { from: relayer, gasPrice: '0' }));
    })
  })

  describe('#isSpent', () => {
    it('should work', async () => {
      const deposit1 = helpers.generateDeposit(chainID)
      const deposit2 = helpers.generateDeposit(chainID)
      await tree.insert(deposit1.commitment)
      await tree.insert(deposit2.commitment)

      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(helpers.toFixedHex(deposit1.commitment));
      
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(helpers.toFixedHex(deposit2.commitment));

      const { root, path_elements, path_index } = await tree.path(1)

      const input = {
        // public
        nullifierHash: deposit2.nullifierHash,
        recipient,
        relayer,
        fee,
        refund,
        chainID: deposit2.chainID,
        roots: [root, 0],
        // private
        nullifier: deposit2.nullifier,
        secret: deposit2.secret,
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

      let res = await snarkjs.groth16.prove('test/fixtures/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ]
      proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);
      await anchor.withdraw(`0x${proofEncoded}`, ...args, { from: relayer, gasPrice: '0' })

      const dep1PaddedNullifier = helpers.bigNumberToPaddedBytes(deposit1.nullifier, 31);
      const dep2PaddedNullifier = helpers.bigNumberToPaddedBytes(deposit2.nullifier, 31);
      const nullifierHash1 = helpers.toFixedHex(helpers.poseidonHasher.hash(null, dep1PaddedNullifier, dep1PaddedNullifier))
      const nullifierHash2 = helpers.toFixedHex(helpers.poseidonHasher.hash(null, dep2PaddedNullifier, dep2PaddedNullifier))
      const spentArray = await anchor.isSpentArray([nullifierHash1, nullifierHash2])
      assert.deepStrictEqual(spentArray, [false, true])
    })
  })

  afterEach(async () => {
    tree = new MerkleTree(levels, null, prefix)
  })
})