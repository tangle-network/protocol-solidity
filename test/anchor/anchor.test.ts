/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { ethers } from 'hardhat';
const TruffleAssert = require('truffle-assertions');

const fs = require('fs');
const path = require('path');
const { toBN, randomHex } = require('web3-utils');

// Typechain generated bindings for contracts
import {
  Anchor2 as Anchor,
  Anchor2__factory as Anchor2Factory,
  PoseidonT3 as Poseidon,
  PoseidonT3__factory as PoseidonFactory,
  VerifierPoseidonBridge,
  VerifierPoseidonBridge__factory as VerifierPoseidonBridgeFactory,
  ERC20Mock as Token,
  ERC20Mock__factory as TokenFactory,
} from '../../typechain';

// Convenience wrapper classes for contract classes
import AnchorClass from '../../lib/darkwebb/Anchor';
import MintableToken from '../../lib/darkwebb/MintableToken';

import chai, { expect } from "chai";

const { NATIVE_AMOUNT, MERKLE_TREE_HEIGHT } = process.env
const snarkjs = require('snarkjs')
const bigInt = require('big-integer');
const BN = require('bn.js');
const F = require('circomlib').babyJub.F;
const Scalar = require("ffjavascript").Scalar;
const helpers = require('../helpers');

const MerkleTree = require('../../lib/MerkleTree');

describe('Anchor2', () => {
  let anchor: Anchor;

  const levels = MERKLE_TREE_HEIGHT || 30
  const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
  let tree: typeof MerkleTree;
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
  const refund = BigInt((new BN('0')).toString());
  const recipient = helpers.getRandomRecipient();
  let verifier: VerifierPoseidonBridge;
  let hasherInstance: Poseidon;
  let token: Token;
  let tokenDenomination = '1000000000000000000' // 1 ether
  const chainID = 31337;
  let createWitness: any;

  beforeEach(async () => {

    const signers = await ethers.getSigners();
    const wallet = signers[0];
    const sender = wallet;

    tree = new MerkleTree(levels, null, null);

    // create poseidon hasher
    const hasherFactory = new PoseidonFactory(wallet);
    hasherInstance = await hasherFactory.deploy();
    await hasherInstance.deployed();

    // create poseidon verifier
    const verifierFactory = new VerifierPoseidonBridgeFactory(wallet);
    verifier = await verifierFactory.deploy();
    await verifier.deployed();

    // create token
    const tokenFactory = new TokenFactory(wallet);
    token = await tokenFactory.deploy();
    await token.deployed();
    await token.mint(sender.address, '10000000000000000000000');

    // create anchor
    const anchorFactory = new Anchor2Factory(wallet);
    anchor = await anchorFactory.deploy(
      verifier.address,
      hasherInstance.address,
      tokenDenomination,
      levels,
      token.address,
      sender.address,
      sender.address,
      sender.address,
    );
    await anchor.deployed();

    createWitness = async (data: any) => {
      const wtns = {type: "mem"};
      await snarkjs.wtns.calculate(data, path.join(
        "test",
        "fixtures",
        "poseidon_bridge_2.wasm"
      ), wtns);
      return wtns;
    }
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
      await token.approve(anchor.address, tokenDenomination);
      let tx = await anchor.deposit(commitment);
      let receipt = await tx.wait();

      const filter = anchor.filters.Deposit(commitment, null, null);
      const events = await anchor.queryFilter(filter, receipt.blockHash);

      assert.strictEqual(events[0].event, 'Deposit')
      assert.strictEqual(events[0].args[0], commitment)
      assert.strictEqual(events[0].args[1], 0);

      const anchorBalance = await token.balanceOf(anchor.address);
      assert.strictEqual(anchorBalance.toString(), toBN(tokenDenomination).toString());
    })

    it.only('should throw if there is a such commitment', async () => {
      const commitment = helpers.toFixedHex(42)
      await token.approve(anchor.address, tokenDenomination)

      console.log(await anchor.getLastRoot());
      await TruffleAssert.passes(anchor.deposit(commitment));
      await TruffleAssert.reverts(
        anchor.deposit(commitment),
        'The commitment has been submitted'
      );
      console.log(await anchor.getLastRoot());

      // try to make another deposit with the same commitment
      // await expect(anchor.deposit(commitment))
      //   .to.be.revertedWith('The commitment has been submitted');
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

      const signers = await ethers.getSigners();
      const relayer = signers[1].address;

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
      const proof = res.proof;
      let publicSignals = res.publicSignals;
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
    it.only('should work', async () => {
      const signers = await ethers.getSigners();
      const user = signers[2].address;
      const operator = signers[0];
      const relayer = signers[1].address;

      const deposit = helpers.generateDeposit(chainID);
      await tree.insert(deposit.commitment)

      await token.mint(user, tokenDenomination);
      const balanceUserBefore = await token.balanceOf(user);
      const balanceAnchorBefore = await token.balanceOf(anchor.address);
      console.log('balanceUserBefore: ', balanceUserBefore.toString());
      console.log('balanceAnchorBefore: ', balanceAnchorBefore.toString());
      // Uncomment to measure gas usage
      // let gas = await anchor.deposit.estimateGas(toBN(deposit.commitment.toString()), { value, from: user })
      // console.log('deposit gas:', gas)
      await token.approve(anchor.address, tokenDenomination);
      const tx = await anchor.deposit(helpers.toFixedHex(deposit.commitment));
      const receipt = await tx.wait();
      console.log(receipt);

      const balanceUserAfterDeposit = await token.balanceOf(user)
      const balanceAnchorAfterDeposit = await token.balanceOf(anchor.address);
      console.log('balanceUserAfterDeposit: ', balanceUserAfterDeposit.toString());
      console.log('balanceAnchorAfterDeposit: ', balanceAnchorAfterDeposit.toString());
      // assert.strictEqual(balanceUserAfterDeposit.toString(), BN(toBN(balanceUserBefore).sub(toBN(value))).toString());
      // assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());

      const { root, path_elements, path_index } = await tree.path(0)

      console.log('This is the root returned by the path from merkle tree', root);

      console.log('last root from contract: ', await anchor.getLastRoot());

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
      const proof = res.proof;
      const publicSignals = res.publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('test/fixtures/circuit_final.zkey');
      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, true);

      const balanceRelayerBefore = await token.balanceOf(relayer)
      const balanceOperatorBefore = await token.balanceOf(operator.address)
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

      const proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);
      console.log('proofEncoded: ', proofEncoded);
      //@ts-ignore
      const { logs } = await anchor.withdraw(`0x${proofEncoded}`, ...args, { gasPrice: '0' });
      const balanceAnchorAfter = await token.balanceOf(anchor.address)
      const balanceRelayerAfter = await token.balanceOf(relayer)
      const balanceOperatorAfter = await token.balanceOf(operator.address)
      const balanceReceiverAfter = await token.balanceOf(helpers.toFixedHex(recipient, 20))
      const feeBN = toBN(fee.toString())
      console.log('balanceAnchorAfter: ', balanceAnchorAfter.toString());
      console.log('balanceRelayerAfter: ', balanceRelayerAfter.toString());
      console.log('balanceOperatorAfter: ', balanceOperatorAfter.toString());
      console.log('balanceReceiverAfter: ', balanceReceiverAfter.toString());
      console.log('feeBN: ', feeBN.toString());
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

    it('should work class', async () => {

      const signers = await ethers.getSigners();
      const user = signers[2].address;
      const operator = signers[0];
      const sender = operator;
      const relayer = signers[1];

      const tokenInstance = await MintableToken.tokenFromAddress(token.address, sender);

      const anchorInstance = await AnchorClass.createAnchor(
        verifier.address,
        hasherInstance.address,
        tokenDenomination,
        levels,
        token.address,
        sender.address,
        sender.address,
        sender.address,
        sender
      );

      await token.mint(sender.address, tokenDenomination);
      const balanceUserBefore = await token.balanceOf(sender.address);
      const balanceAnchorBefore = await token.balanceOf(anchorInstance.contract.address);
      console.log('balanceUserBefore: ', balanceUserBefore.toString());
      console.log('balanceAnchorBefore: ', balanceAnchorBefore.toString());

      await tokenInstance.approveSpending(anchorInstance.contract.address);
      const { deposit, index } = await anchorInstance.deposit();

      const balanceUserAfterDeposit = await token.balanceOf(sender.address)
      const balanceAnchorAfterDeposit = await token.balanceOf(anchorInstance.contract.address);
      console.log('balanceUserAfterDeposit: ', balanceUserAfterDeposit.toString());
      console.log('balanceAnchorAfterDeposit: ', balanceAnchorAfterDeposit.toString());
      assert.strictEqual(balanceUserAfterDeposit.toString(), BN(toBN(balanceUserBefore).sub(toBN(value))).toString());
      assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());

      const balanceRelayerBefore = await token.balanceOf(relayer.address)
      const balanceReceiverBefore = await token.balanceOf(helpers.toFixedHex(recipient, 20))

      let isSpent = await anchorInstance.contract.isSpent(helpers.toFixedHex(deposit.nullifierHash))
      assert.strictEqual(isSpent, false)

      const receipt = await anchorInstance.withdraw(deposit, index, recipient, relayer.address, fee.toString());

      const filter = anchorInstance.contract.filters.Withdrawal(null, null, relayer.address, null);
      const event = await anchorInstance.contract.queryFilter(filter, receipt.blockHash);
      console.log(event);

      const balanceAnchorAfter = await token.balanceOf(anchorInstance.contract.address)
      const balanceRelayerAfter = await token.balanceOf(relayer.address)
      const balanceReceiverAfter = await token.balanceOf(helpers.toFixedHex(recipient, 20))
      const feeBN = toBN(fee.toString())
      console.log('balanceAnchorAfter: ', balanceAnchorAfter.toString());
      console.log('balanceRelayerAfter: ', balanceRelayerAfter.toString());
      console.log('balanceReceiverAfter: ', balanceReceiverAfter.toString());
      console.log('feeBN: ', feeBN.toString());
      assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
      assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())
      assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).add(feeBN).toString())

      // assert.strictEqual(log.name, 'Withdrawal')
      // assert.strictEqual(log.args[0].nullifierHash, helpers.toFixedHex(deposit.nullifierHash))
      // assert.strictEqual(log.args[0].toString(), feeBN.toString());
      isSpent = await anchor.isSpent(helpers.toFixedHex(deposit.nullifierHash))
      assert(isSpent);
    })

    it('should prevent double spend', async () => {
      
      const signers = await ethers.getSigners();
      const operator = signers[0];

      const deposit = helpers.generateDeposit(chainID);
      await tree.insert(deposit.commitment);
      await token.approve(anchor.address, tokenDenomination);
      await anchor.deposit(helpers.toFixedHex(deposit.commitment));

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
      const proof = res.proof;
      const publicSignals = res.publicSignals;

      const args = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];

      const proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);

      //@ts-ignore
      let tx = await anchor.withdraw(`0x${proofEncoded}`, ...args, { gasPrice: '0' });
      await tx.wait();

      //@ts-ignore
      await expect(anchor.withdraw(`0x${proofEncoded}`, ...args, { gasPrice: '0' }))
        .to.be.revertedWith('The note has been already spent');
    })

    it('should prevent double spend with overflow', async () => {
      const signers = await ethers.getSigners();
      const relayer = signers[0];

      const deposit = helpers.generateDeposit(chainID)
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(helpers.toFixedHex(deposit.commitment))

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
      const proof = res.proof;
      let publicSignals = res.publicSignals;

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

      const proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);

      //@ts-ignore
      await expect(anchor.withdraw(`0x${proofEncoded}`, ...args, { gasPrice: '0' }))
        .to.be.revertedWith('verifier-gte-snark-scalar-field');
    })

    it('fee should be less or equal transfer value', async () => {
      const signers = await ethers.getSigners();
      const relayer = signers[0];

      const deposit = helpers.generateDeposit(chainID)
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(helpers.toFixedHex(deposit.commitment))

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
      const proof = res.proof;
      let publicSignals = res.publicSignals;

      const args = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ]

      const proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);

      //@ts-ignore
      await expect(anchor.withdraw(`0x${proofEncoded}`, ...args, { gasPrice: '0' }))
        .to.be.revertedWith('Fee exceeds transfer value');
    })

    it('should throw for corrupted merkle tree root', async () => {
      const signers = await ethers.getSigners();
      const relayer = signers[0];

      const deposit = helpers.generateDeposit(chainID)
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(helpers.toFixedHex(deposit.commitment))

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
      const proof = res.proof;
      let publicSignals = res.publicSignals;

      const args = [
        helpers.createRootsBytes([randomHex(32), 0]),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ]

      const proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);

      //@ts-ignore
      await expect(anchor.withdraw(`0x${proofEncoded}`, ...args, { gasPrice: '0' }))
        .to.be.revertedWith('Cannot find your merkle root');
    })

    it('should reject with tampered public inputs', async () => {
      const signers = await ethers.getSigners();
      const relayer = signers[0];

      const deposit = helpers.generateDeposit(chainID)
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(helpers.toFixedHex(deposit.commitment))

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
      const proof = res.proof;
      let publicSignals = res.publicSignals;

      const args = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ]

      // recipient
      let incorrectArgs = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];

      const proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);

      //@ts-ignore
      await expect(anchor.withdraw(`0x${proofEncoded}`, ...args, { gasPrice: '0' }))
        .to.be.revertedWith('Invalid withdraw proof');

      // fee
      incorrectArgs = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex('0x000000000000000000000000000000000000000000000000015345785d8a0000'),
        helpers.toFixedHex(input.refund),
      ];

      //@ts-ignore
      await expect(anchor.withdraw(`0x${proofEncoded}`, ...args, { gasPrice: '0' }))
        .to.be.revertedWith('Invalid withdraw proof');

      // nullifier
      incorrectArgs = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex('0x00abdfc78211f8807b9c6504a6e537e71b8788b2f529a95f1399ce124a8642ad'),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];

      //@ts-ignore
      await expect(anchor.withdraw(`0x${proofEncoded}`, ...args, { gasPrice: '0' }))
        .to.be.revertedWith('Invalid withdraw proof');

      // should work with original values
      //@ts-ignore
      let tx = await anchor.withdraw(`0x${proofEncoded}`, ...args, { gasPrice: '0' });
      await tx.wait();
      expect('withdraw').to.be.calledOnContract(anchor);
    })
  })

  describe('#isSpent', () => {
    it('should work', async () => {
      const signers = await ethers.getSigners();
      const relayer = signers[0];

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
      const proof = res.proof;
      let publicSignals = res.publicSignals;

      const args = [
        helpers.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ]
      const proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);
      
      //@ts-ignore
      await anchor.withdraw(`0x${proofEncoded}`, ...args, { gasPrice: '0' })

      const dep1PaddedNullifier = helpers.bigNumberToPaddedBytes(deposit1.nullifier, 31);
      const dep2PaddedNullifier = helpers.bigNumberToPaddedBytes(deposit2.nullifier, 31);
      const nullifierHash1 = helpers.toFixedHex(helpers.poseidonHasher.hash(null, dep1PaddedNullifier, dep1PaddedNullifier))
      const nullifierHash2 = helpers.toFixedHex(helpers.poseidonHasher.hash(null, dep2PaddedNullifier, dep2PaddedNullifier))
      const spentArray = await anchor.isSpentArray([nullifierHash1, nullifierHash2])
      assert.deepStrictEqual(spentArray, [false, true])
    })
  })
})