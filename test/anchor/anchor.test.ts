/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { artifacts, ethers } from 'hardhat';
const TruffleAssert = require('truffle-assertions');

const fs = require('fs');
const path = require('path');
const { toBN, randomHex } = require('web3-utils');
const Poseidon = artifacts.require('PoseidonT3');

// Typechain generated bindings for contracts
import {
  ERC20Mock as Token,
  ERC20Mock__factory as TokenFactory,
  GovernedTokenWrapper as WrappedToken,
  GovernedTokenWrapper__factory as WrappedTokenFactory,
} from '../../typechain';

// Convenience wrapper classes for contract classes
import Anchor from '../../lib/darkwebb/Anchor';
import { getHasherFactory } from '../../lib/darkwebb/utils';
import Verifier from '../../lib/darkwebb/Verifier';
import MintableToken from '../../lib/darkwebb/MintableToken';

const { NATIVE_AMOUNT } = process.env
const snarkjs = require('snarkjs')
const bigInt = require('big-integer');
const BN = require('bn.js');
const F = require('circomlibjs').babyjub.F;
const Scalar = require("ffjavascript").Scalar;

const helpers = require('../../lib/darkwebb/utils');
const MerkleTree = require('../../lib/MerkleTree');

describe('Anchor for 2 max edges', () => {
  let anchor: Anchor;

  const levels = 30;
  const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
  let tree: typeof MerkleTree;
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
  const refund = BigInt((new BN('0')).toString());
  let recipient = "0x1111111111111111111111111111111111111111";
  let verifier: Verifier;
  let hasherInstance: any;
  let token: Token;
  let wrappedToken: WrappedToken;
  let tokenDenomination = '1000000000000000000' // 1 ether
  const chainID = 31337;
  const MAX_EDGES = 1;
  let createWitness: any;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    const sender = wallet;

    tree = new MerkleTree(levels, null, null);

    // create poseidon hasher
    const hasherFactory = await getHasherFactory(wallet);
    hasherInstance = await hasherFactory.deploy();
    await hasherInstance.deployed();

    // create poseidon verifier
    verifier = await Verifier.createVerifier(sender);

    // create token
    const tokenFactory = new TokenFactory(wallet);
    token = await tokenFactory.deploy();
    await token.deployed();
    await token.mint(sender.address, '10000000000000000000000');

    // create Anchor
    anchor = await Anchor.createAnchor(
      verifier.contract.address,
      hasherInstance.address,
      tokenDenomination,
      levels,
      token.address,
      sender.address,
      sender.address,
      sender.address,
      MAX_EDGES,
      sender,
    );

    // approve the anchor to spend the minted funds
    await token.approve(anchor.contract.address, '10000000000000000000000');

    createWitness = async (data: any) => {
      const wtns = {type: "mem"};
      await snarkjs.wtns.calculate(data, path.join(
        "test",
        "fixtures/2",
        "poseidon_bridge_2.wasm"
      ), wtns);
      return wtns;
    }
  })

  describe('#constructor', () => {
    it('should initialize', async () => {
      const etherDenomination = await anchor.contract.denomination()
      assert.strictEqual(etherDenomination.toString(), toBN(value).toString());
    });
  })

  describe('#deposit', () => {
    it('should emit event', async () => {
      let { deposit } = await anchor.deposit();

      const filter = anchor.contract.filters.Deposit(helpers.toFixedHex(deposit.commitment), null, null);
      const events = await anchor.contract.queryFilter(filter, anchor.contract.deployTransaction.blockNumber);

      assert.strictEqual(events[0].event, 'Deposit');
      assert.strictEqual(events[0].args[0], helpers.toFixedHex(deposit.commitment));
      assert.strictEqual(events[0].args[1], 0);

      const anchorBalance = await token.balanceOf(anchor.contract.address);
      assert.strictEqual(anchorBalance.toString(), toBN(tokenDenomination).toString());
    });

    it('should throw if there is a such commitment', async () => {
      const commitment = helpers.toFixedHex(42)

      await TruffleAssert.passes(anchor.contract.deposit(commitment));
      await TruffleAssert.reverts(
        anchor.contract.deposit(commitment),
        'The commitment has been submitted'
      );
    });
  })

  // Use Node version >=12
  describe('snark proof verification on js side', () => {
    it('should detect tampering', async () => {
      const deposit = Anchor.generateDeposit(chainID);
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
        refreshCommitment: 0,
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

      let res = await snarkjs.groth16.prove('test/fixtures/2/circuit_final.zkey', wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      let tempProof = proof;
      let tempSignals = publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('test/fixtures/2/circuit_final.zkey');

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
  })

  describe('#withdraw', () => {
    it('should work', async () => {
      const signers = await ethers.getSigners();
      const sender = signers[0];
      const relayer = signers[1];

      const balanceUserBefore = await token.balanceOf(sender.address);
      const { deposit, index } = await anchor.deposit();

      const balanceUserAfterDeposit = await token.balanceOf(sender.address)
      const balanceAnchorAfterDeposit = await token.balanceOf(anchor.contract.address);
      assert.strictEqual(balanceUserAfterDeposit.toString(), BN(toBN(balanceUserBefore).sub(toBN(value))).toString());
      assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());

      const balanceRelayerBefore = await token.balanceOf(relayer.address)
      const balanceReceiverBefore = await token.balanceOf(helpers.toFixedHex(recipient, 20))

      let isSpent = await anchor.contract.isSpent(helpers.toFixedHex(deposit.nullifierHash))
      assert.strictEqual(isSpent, false)

      let receipt = await anchor.withdraw(deposit, index, recipient, relayer.address, fee, bigInt(0));
      const filter = anchor.contract.filters.Withdrawal(null, null, relayer.address, null);
      const events = await anchor.contract.queryFilter(filter, receipt.blockHash);

      const balanceAnchorAfter = await token.balanceOf(anchor.contract.address)
      const balanceRelayerAfter = await token.balanceOf(relayer.address)
      const balanceReceiverAfter = await token.balanceOf(helpers.toFixedHex(recipient, 20))
      const feeBN = toBN(fee.toString())
      assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
      assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())
      assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).add(feeBN).toString())

      assert.strictEqual(events[0].event, 'Withdrawal')
      assert.strictEqual(events[0].args[1], helpers.toFixedHex(deposit.nullifierHash))
      assert.strictEqual(events[0].args[3].toString(), feeBN.toString());
      isSpent = await anchor.contract.isSpent(helpers.toFixedHex(deposit.nullifierHash))
      assert(isSpent);
    });

    it('should prevent double spend', async () => {
      const signers = await ethers.getSigners();
      const sender = signers[0];
      const relayer = signers[1];

      const { deposit, index } = await anchor.deposit();
      
      //@ts-ignore
      let receipt = await anchor.withdraw(deposit, index, sender.address, relayer.address, fee, bigInt(0));

      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.withdraw(deposit, index, sender.address, relayer.address, fee, bigInt(0)),
        'The note has been already spent',
      );
    });

    it('should prevent double spend with overflow', async () => {
      const signers = await ethers.getSigners();
      const relayer = signers[0];

      const deposit = Anchor.generateDeposit(chainID)
      await tree.insert(deposit.commitment)
      await anchor.contract.deposit(helpers.toFixedHex(deposit.commitment))

      const { root, path_elements, path_index } = await tree.path(0)

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        refreshCommitment: 0,
        recipient,
        relayer: relayer.address,
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

      let res = await snarkjs.groth16.prove('test/fixtures/2/circuit_final.zkey', wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;

      const args = [
        Anchor.createRootsBytes(input.roots),
        helpers.toFixedHex(
          toBN(input.nullifierHash).add(
            toBN('21888242871839275222246405745257275088548364400416034343698204186575808495617'),
          ),
        ),
        helpers.toFixedHex(input.refreshCommitment, 32),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];

      const proofEncoded = await Anchor.generateWithdrawProofCallData(proof, publicSignals);
      const publicInputs = Anchor.convertArgsArrayToStruct(args);

      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.withdraw(`0x${proofEncoded}`, publicInputs, { gasPrice: '0' }),
        'verifier-gte-snark-scalar-field',
      );
    });

    it('fee should be less or equal transfer value', async () => {
      const signers = await ethers.getSigners();
      const relayer = signers[0];

      const { deposit, index } = await anchor.deposit();
      const largeFee = bigInt(value).add(bigInt(1_000_000));
      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.withdraw(deposit, index, recipient, relayer.address, largeFee, bigInt(0)),
        'Fee exceeds transfer value',
      );
    });

    it('should throw for corrupted merkle tree root', async () => {
      const signers = await ethers.getSigners();
      const relayer = signers[0];

      const deposit = Anchor.generateDeposit(chainID)
      await tree.insert(deposit.commitment)
      await anchor.contract.deposit(helpers.toFixedHex(deposit.commitment))

      const { root, path_elements, path_index } = await tree.path(0)

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        refreshCommitment: 0,
        recipient,
        relayer: relayer.address,
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

      let res = await snarkjs.groth16.prove('test/fixtures/2/circuit_final.zkey', wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;

      const args = [
        Anchor.createRootsBytes([randomHex(32), 0]),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.refreshCommitment, 32),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ]

      const proofEncoded = await Anchor.generateWithdrawProofCallData(proof, publicSignals);
      const publicInputs = Anchor.convertArgsArrayToStruct(args);

      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.withdraw(`0x${proofEncoded}`, publicInputs, { gasPrice: '0' }),
        'Cannot find your merkle root'
      );
    });

    it('should reject with tampered public inputs', async () => {
      const signers = await ethers.getSigners();
      const relayer = signers[0];

      const deposit = Anchor.generateDeposit(chainID)
      await tree.insert(deposit.commitment)
      await anchor.contract.deposit(helpers.toFixedHex(deposit.commitment))

      let { root, path_elements, path_index } = await tree.path(0)

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        refreshCommitment: 0,
        recipient,
        relayer: relayer.address,
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

      let res = await snarkjs.groth16.prove('test/fixtures/2/circuit_final.zkey', wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;

      const args = [
        Anchor.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.refreshCommitment, 32),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ]
      const publicInputs = Anchor.convertArgsArrayToStruct(args);

      // recipient
      let incorrectArgs = [
        Anchor.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.refreshCommitment, 32),
        helpers.toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];

      const proofEncoded = await Anchor.generateWithdrawProofCallData(proof, publicSignals);
      let incorrectPublicInputs = Anchor.convertArgsArrayToStruct(incorrectArgs);
      
      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.withdraw(`0x${proofEncoded}`, incorrectPublicInputs, { gasPrice: '0' }),
        'Invalid withdraw proof',
      );

      // fee
      incorrectArgs = [
        Anchor.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex(input.refreshCommitment, 32),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex('0x000000000000000000000000000000000000000000000000015345785d8a0000'),
        helpers.toFixedHex(input.refund),
      ];
      incorrectPublicInputs = Anchor.convertArgsArrayToStruct(incorrectArgs);

      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.withdraw(`0x${proofEncoded}`, incorrectPublicInputs, { gasPrice: '0' }),
        'Invalid withdraw proof',
      );

      // nullifier
      incorrectArgs = [
        Anchor.createRootsBytes(input.roots),
        helpers.toFixedHex('0x00abdfc78211f8807b9c6504a6e537e71b8788b2f529a95f1399ce124a8642ad'),
        helpers.toFixedHex(input.refreshCommitment, 32),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];

      incorrectPublicInputs = Anchor.convertArgsArrayToStruct(incorrectArgs);
      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.withdraw(`0x${proofEncoded}`, incorrectPublicInputs, { gasPrice: '0' }),
        'Invalid withdraw proof',
      );

      // refresh commitment
      incorrectArgs = [
        Anchor.createRootsBytes(input.roots),
        helpers.toFixedHex(input.nullifierHash),
        helpers.toFixedHex('0x00abdfc78211f8807b9c6504a6e537e71b8788b2f529a95f1399ce124a8642ad'),
        helpers.toFixedHex(input.recipient, 20),
        helpers.toFixedHex(input.relayer, 20),
        helpers.toFixedHex(input.fee),
        helpers.toFixedHex(input.refund),
      ];
      incorrectPublicInputs = Anchor.convertArgsArrayToStruct(incorrectArgs);

      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.withdraw(`0x${proofEncoded}`, incorrectPublicInputs, { gasPrice: '0' }),
        'Invalid withdraw proof',
      );

      // should work with original values
      //@ts-ignore
      await TruffleAssert.passes(anchor.contract.withdraw(
        `0x${proofEncoded}`,
        publicInputs,
        { gasPrice: '0' }
      ));
    }).timeout(60000);
  })

  describe('#isSpent', () => {
    it('should work', async () => {
      const signers = await ethers.getSigners();
      const relayer = signers[0];

      const { deposit: deposit1, index: index1 } = await anchor.deposit();
      const { deposit: deposit2, index: index2 } = await anchor.deposit();

      //@ts-ignore
      await anchor.withdraw(deposit1, index1, signers[0].address, relayer.address, fee, bigInt(0));

      const spentArray = await anchor.contract.isSpentArray([
        helpers.toFixedHex(deposit2.nullifierHash),
        helpers.toFixedHex(deposit1.nullifierHash)
      ]);
      assert.deepStrictEqual(spentArray, [false, true])
    });
  })

  describe('#WrapperClass', () => {
    it('should deposit without latest history', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];

      // create a deposit on the anchor already setup
      await anchor.deposit();

      // create a new anchor by connecting to the address of the setup anchor
      const newAnchor = await Anchor.connect(anchor.contract.address, wallet);

      // make sure the deposit goes through
      await TruffleAssert.passes(newAnchor.deposit());
      assert.strictEqual(newAnchor.latestSyncedBlock, 0);
    });

    it('should properly update to the latest on-chain', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];

      // create a deposit on the anchor already setup
      await anchor.deposit();

      // create a new anchor by connecting to the address of the setup anchor
      const newAnchor = await Anchor.connect(anchor.contract.address, wallet);
      await newAnchor.update();

      // check that the merkle roots are the same for both anchor instances
      assert.strictEqual(await anchor.tree.get_root(), await newAnchor.tree.get_root());
    });

    it('should properly update before withdraw tx', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];

      // create a deposit on the anchor already setup
      const { deposit, index } = await anchor.deposit();

      // create a new anchor by connecting to the address of the setup anchor
      const newAnchor = await Anchor.connect(anchor.contract.address, wallet);
      await TruffleAssert.passes(newAnchor.withdraw(deposit, index, recipient, signers[1].address, fee, bigInt(0)));
    });

    it('should properly refresh a deposit', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const relayer = signers[1].address;

      // create a deposit on the anchor already setup
      const { deposit, index } = await anchor.deposit();
      const refreshedDestId = await wallet.getChainId();
      const refreshedDeposit = Anchor.generateDeposit(refreshedDestId);

      const { merkleRoot, pathElements, pathIndices } = anchor.tree.path(0);
      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        refreshCommitment: refreshedDeposit.commitment,
        recipient,
        relayer,
        fee,
        refund,
        chainID: deposit.chainID,
        roots: [merkleRoot, 0],
        // private
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: pathElements,
        pathIndices: pathIndices,
        diffs: [merkleRoot, 0].map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${merkleRoot}`),
          ).toString();
        }),
      };
      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('test/fixtures/2/circuit_final.zkey', wtns);
      const vKey = await snarkjs.zKey.exportVerificationKey('test/fixtures/2/circuit_final.zkey');

      res = await snarkjs.groth16.verify(vKey, res.publicSignals, res.proof);
      assert(res);

      // create a new anchor by connecting to the address of the setup anchor
      let newAnchor = await Anchor.connect(anchor.contract.address, wallet);
      await TruffleAssert.passes(newAnchor.withdraw(
        deposit,
        index,
        recipient,
        signers[1].address,
        fee,
        refreshedDeposit.commitment
      ));
      await TruffleAssert.passes(newAnchor.withdraw(
        refreshedDeposit,
        index + 1,
        recipient,
        signers[1].address,
        fee,
        0,
      ));
    });

    it('should wrap and deposit', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;
      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol, sender.address, '10000000000000000000000000', true);
      await wrappedToken.deployed();
      await wrappedToken.add(token.address);

      // create Anchor for wrapped token
      const wrappedAnchor = await Anchor.createAnchor(
        verifier.contract.address,
        hasherInstance.address,
        tokenDenomination,
        levels,
        wrappedToken.address,
        sender.address,
        sender.address,
        sender.address,
        MAX_EDGES,
        sender
      );

      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await wrappedToken.grantRole(MINTER_ROLE, wrappedAnchor.contract.address);

      await token.approve(wrappedToken.address, '1000000000000000000');
      const balTokenBeforeDepositSender = await token.balanceOf(sender.address);
      // create a deposit on the anchor already setup
      const { deposit, index } = await wrappedAnchor.wrapAndDeposit(
        token.address,
      );
      const balTokenAfterDepositSender = await token.balanceOf(sender.address);
      assert.strictEqual(balTokenBeforeDepositSender.sub(balTokenAfterDepositSender).toString(), '1000000000000000000');

      const balWrappedTokenAfterDepositAnchor = await wrappedToken.balanceOf(wrappedAnchor.contract.address);
      const balWrappedTokenAfterDepositSender = await wrappedToken.balanceOf(sender.address);
      const newAnchor = await Anchor.connect(wrappedAnchor.contract.address, wallet);
      await TruffleAssert.passes(newAnchor.withdraw(deposit, index, sender.address, signers[1].address, bigInt(0), bigInt(0)));
      const balWrappedTokenAfterWithdrawSender = await wrappedToken.balanceOf(sender.address);
      const balWrappedTokenAfterWithdrawAnchor = await wrappedToken.balanceOf(wrappedAnchor.contract.address);
      assert.strictEqual(balWrappedTokenAfterWithdrawSender.sub(balWrappedTokenAfterDepositSender).toString(), '1000000000000000000');
      assert.strictEqual(balWrappedTokenAfterDepositAnchor.sub(balWrappedTokenAfterWithdrawAnchor).toString(), '1000000000000000000');
    });

    it.only('should withdraw and unwrap', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;
      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol, sender.address, '10000000000000000000000000', true);
      await wrappedToken.deployed();
      await wrappedToken.add(token.address);

      // create Anchor for wrapped token
      const wrappedAnchor = await Anchor.createAnchor(
        verifier.contract.address,
        hasherInstance.address,
        tokenDenomination,
        levels,
        wrappedToken.address,
        sender.address,
        sender.address,
        sender.address,
        MAX_EDGES,
        sender
      );

      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await wrappedToken.grantRole(MINTER_ROLE, wrappedAnchor.contract.address);

      await token.approve(wrappedToken.address, '1000000000000000000');
      const balTokenBeforeDepositSender = await token.balanceOf(sender.address);
      // create a deposit on the anchor already setup
      const { deposit, index, originChainId } = await wrappedAnchor.wrapAndDeposit(
        token.address,
      );

      console.log('sender address in test', sender.address);

      // Check that the anchor has the appropriate amount of wrapped token balance
      const anchorWrappedTokenBalance = await wrappedToken.balanceOf(wrappedAnchor.contract.address);
      assert.deepStrictEqual(anchorWrappedTokenBalance.toString(), tokenDenomination);

      console.log('anchor has the appropriate amount of wrapped token balance');

      // Check that the anchor's token wrapper has the appropriate amount of token balance
      const anchorTokenWrapper = await wrappedAnchor.contract.token();
      const anchorTokenWrapperBalance = await token.balanceOf(anchorTokenWrapper);
      assert.deepStrictEqual(anchorTokenWrapperBalance.toString(), tokenDenomination);

      console.log('wrapped token has the appropriate amount of token balance');

      const newAnchor = await Anchor.connect(wrappedAnchor.contract.address, wallet);
      await TruffleAssert.passes(newAnchor.withdrawAndUnwrap(
        deposit,
        originChainId,
        index,
        sender.address,
        signers[1].address,
        bigInt(0),
        bigInt(0),
        token.address
      ));

      const balTokenAfterWithdrawAndUnwrapSender = await token.balanceOf(sender.address);
      assert.strictEqual(balTokenBeforeDepositSender.toString(), balTokenAfterWithdrawAndUnwrapSender.toString());
    });
  });
});

// Test deposit and withdraw on the same anchor - but it's 3 roots to pass in.
describe('Anchor for 3 max edges', () => {
  let anchor: Anchor;

  const levels = 30;
  const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
  let tree: typeof MerkleTree;
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
  const refund = BigInt((new BN('0')).toString());
  let recipient = "0x1111111111111111111111111111111111111111";
  let verifier: Verifier;
  let hasherInstance: any;
  let token: Token;
  let wrappedToken: WrappedToken;
  let tokenDenomination = '1000000000000000000' // 1 ether
  const MAX_EDGES = 2;
  let createWitness: any;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    const sender = wallet;

    tree = new MerkleTree(levels, null, null);

    // create poseidon hasher
    const hasherFactory = await getHasherFactory(wallet);
    hasherInstance = await hasherFactory.deploy();
    await hasherInstance.deployed();

    // create poseidon verifier
    verifier = await Verifier.createVerifier(sender);

    // create token
    const tokenFactory = new TokenFactory(wallet);
    token = await tokenFactory.deploy();
    await token.deployed();
    await token.mint(sender.address, '10000000000000000000000');

    // create Anchor
    anchor = await Anchor.createAnchor(
      verifier.contract.address,
      hasherInstance.address,
      tokenDenomination,
      levels,
      token.address,
      sender.address,
      sender.address,
      sender.address,
      MAX_EDGES,
      sender,
    );

    // approve the anchor to spend the minted funds
    await token.approve(anchor.contract.address, '10000000000000000000000');

    createWitness = async (data: any) => {
      const wtns = {type: "mem"};
      await snarkjs.wtns.calculate(data, path.join(
        "test",
        "fixtures/3",
        "poseidon_bridge_3.wasm"
      ), wtns);
      return wtns;
    }
  })

  it.skip('should withdraw successfully', async () => {
    const signers = await ethers.getSigners();
    const sender = signers[0];
    const relayer = signers[1];

    const balanceUserBefore = await token.balanceOf(sender.address);
    const { deposit, index } = await anchor.deposit();

    const balanceUserAfterDeposit = await token.balanceOf(sender.address)
    const balanceAnchorAfterDeposit = await token.balanceOf(anchor.contract.address);
    assert.strictEqual(balanceUserAfterDeposit.toString(), BN(toBN(balanceUserBefore).sub(toBN(value))).toString());
    assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());

    const balanceRelayerBefore = await token.balanceOf(relayer.address)
    const balanceReceiverBefore = await token.balanceOf(helpers.toFixedHex(recipient, 20))

    let isSpent = await anchor.contract.isSpent(helpers.toFixedHex(deposit.nullifierHash))
    assert.strictEqual(isSpent, false)

    let receipt = await anchor.withdraw(deposit, index, recipient, relayer.address, fee, bigInt(0));
    const filter = anchor.contract.filters.Withdrawal(null, null, relayer.address, null);
    const events = await anchor.contract.queryFilter(filter, receipt.blockHash);

    const balanceAnchorAfter = await token.balanceOf(anchor.contract.address)
    const balanceRelayerAfter = await token.balanceOf(relayer.address)
    const balanceReceiverAfter = await token.balanceOf(helpers.toFixedHex(recipient, 20))
    const feeBN = toBN(fee.toString())
    assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
    assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())
    assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).add(feeBN).toString())

    assert.strictEqual(events[0].event, 'Withdrawal')
    assert.strictEqual(events[0].args[1], helpers.toFixedHex(deposit.nullifierHash))
    assert.strictEqual(events[0].args[3].toString(), feeBN.toString());
    isSpent = await anchor.contract.isSpent(helpers.toFixedHex(deposit.nullifierHash))
    assert(isSpent);
  })
});

// Test deposit and withdraw on the same anchor - but it's 4 roots to pass in.
describe('Anchor for 4 max edges', () => {
  let anchor: Anchor;

  const levels = 30;
  const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
  let tree: typeof MerkleTree;
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
  const refund = BigInt((new BN('0')).toString());
  let recipient = "0x1111111111111111111111111111111111111111";
  let verifier: Verifier;
  let hasherInstance: any;
  let token: Token;
  let wrappedToken: WrappedToken;
  let tokenDenomination = '1000000000000000000' // 1 ether
  const MAX_EDGES = 3;
  let createWitness: any;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    const sender = wallet;

    tree = new MerkleTree(levels, null, null);

    // create poseidon hasher
    const hasherFactory = await getHasherFactory(wallet);
    hasherInstance = await hasherFactory.deploy();
    await hasherInstance.deployed();

    // create poseidon verifier
    verifier = await Verifier.createVerifier(sender);

    // create token
    const tokenFactory = new TokenFactory(wallet);
    token = await tokenFactory.deploy();
    await token.deployed();
    await token.mint(sender.address, '10000000000000000000000');

    // create Anchor
    anchor = await Anchor.createAnchor(
      verifier.contract.address,
      hasherInstance.address,
      tokenDenomination,
      levels,
      token.address,
      sender.address,
      sender.address,
      sender.address,
      MAX_EDGES,
      sender,
    );

    // approve the anchor to spend the minted funds
    await token.approve(anchor.contract.address, '10000000000000000000000');

    createWitness = async (data: any) => {
      const wtns = {type: "mem"};
      await snarkjs.wtns.calculate(data, path.join(
        "test",
        "fixtures/4",
        "poseidon_bridge_4.wasm"
      ), wtns);
      return wtns;
    }
  })

  it('should withdraw successfully', async () => {
    const signers = await ethers.getSigners();
    const sender = signers[0];
    const relayer = signers[1];

    const balanceUserBefore = await token.balanceOf(sender.address);
    const { deposit, index } = await anchor.deposit();

    const balanceUserAfterDeposit = await token.balanceOf(sender.address)
    const balanceAnchorAfterDeposit = await token.balanceOf(anchor.contract.address);
    assert.strictEqual(balanceUserAfterDeposit.toString(), BN(toBN(balanceUserBefore).sub(toBN(value))).toString());
    assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());

    const balanceRelayerBefore = await token.balanceOf(relayer.address)
    const balanceReceiverBefore = await token.balanceOf(helpers.toFixedHex(recipient, 20))

    let isSpent = await anchor.contract.isSpent(helpers.toFixedHex(deposit.nullifierHash))
    assert.strictEqual(isSpent, false)

    let receipt = await anchor.withdraw(deposit, index, recipient, relayer.address, fee, bigInt(0));
    const filter = anchor.contract.filters.Withdrawal(null, null, relayer.address, null);
    const events = await anchor.contract.queryFilter(filter, receipt.blockHash);

    const balanceAnchorAfter = await token.balanceOf(anchor.contract.address)
    const balanceRelayerAfter = await token.balanceOf(relayer.address)
    const balanceReceiverAfter = await token.balanceOf(helpers.toFixedHex(recipient, 20))
    const feeBN = toBN(fee.toString())
    assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
    assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())
    assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).add(feeBN).toString())

    assert.strictEqual(events[0].event, 'Withdrawal')
    assert.strictEqual(events[0].args[1], helpers.toFixedHex(deposit.nullifierHash))
    assert.strictEqual(events[0].args[3].toString(), feeBN.toString());
    isSpent = await anchor.contract.isSpent(helpers.toFixedHex(deposit.nullifierHash))
    assert(isSpent);
  })
});

// Test deposit and withdraw on the same anchor - but it's 4 roots to pass in.
describe('Anchor for 5 max edges', () => {
  let anchor: Anchor;

  const levels = 30;
  const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
  let tree: typeof MerkleTree;
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
  const refund = BigInt((new BN('0')).toString());
  let recipient = "0x1111111111111111111111111111111111111111";
  let verifier: Verifier;
  let hasherInstance: any;
  let token: Token;
  let wrappedToken: WrappedToken;
  let tokenDenomination = '1000000000000000000' // 1 ether
  const MAX_EDGES = 4;
  let createWitness: any;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    const sender = wallet;

    tree = new MerkleTree(levels, null, null);

    // create poseidon hasher
    const hasherFactory = await getHasherFactory(wallet);
    hasherInstance = await hasherFactory.deploy();
    await hasherInstance.deployed();

    // create poseidon verifier
    verifier = await Verifier.createVerifier(sender);

    // create token
    const tokenFactory = new TokenFactory(wallet);
    token = await tokenFactory.deploy();
    await token.deployed();
    await token.mint(sender.address, '10000000000000000000000');

    // create Anchor
    anchor = await Anchor.createAnchor(
      verifier.contract.address,
      hasherInstance.address,
      tokenDenomination,
      levels,
      token.address,
      sender.address,
      sender.address,
      sender.address,
      MAX_EDGES,
      sender,
    );

    // approve the anchor to spend the minted funds
    await token.approve(anchor.contract.address, '10000000000000000000000');

    createWitness = async (data: any) => {
      const wtns = {type: "mem"};
      await snarkjs.wtns.calculate(data, path.join(
        "test",
        "fixtures/5",
        "poseidon_bridge_5.wasm"
      ), wtns);
      return wtns;
    }
  })

  it('should withdraw successfully', async () => {
    const signers = await ethers.getSigners();
    const sender = signers[0];
    const relayer = signers[1];

    const balanceUserBefore = await token.balanceOf(sender.address);
    const { deposit, index } = await anchor.deposit();

    const balanceUserAfterDeposit = await token.balanceOf(sender.address)
    const balanceAnchorAfterDeposit = await token.balanceOf(anchor.contract.address);
    assert.strictEqual(balanceUserAfterDeposit.toString(), BN(toBN(balanceUserBefore).sub(toBN(value))).toString());
    assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());

    const balanceRelayerBefore = await token.balanceOf(relayer.address)
    const balanceReceiverBefore = await token.balanceOf(helpers.toFixedHex(recipient, 20))

    let isSpent = await anchor.contract.isSpent(helpers.toFixedHex(deposit.nullifierHash))
    assert.strictEqual(isSpent, false)

    let receipt = await anchor.withdraw(deposit, index, recipient, relayer.address, fee, bigInt(0));
    const filter = anchor.contract.filters.Withdrawal(null, null, relayer.address, null);
    const events = await anchor.contract.queryFilter(filter, receipt.blockHash);

    const balanceAnchorAfter = await token.balanceOf(anchor.contract.address)
    const balanceRelayerAfter = await token.balanceOf(relayer.address)
    const balanceReceiverAfter = await token.balanceOf(helpers.toFixedHex(recipient, 20))
    const feeBN = toBN(fee.toString())
    assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
    assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())
    assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).add(feeBN).toString())

    assert.strictEqual(events[0].event, 'Withdrawal')
    assert.strictEqual(events[0].args[1], helpers.toFixedHex(deposit.nullifierHash))
    assert.strictEqual(events[0].args[3].toString(), feeBN.toString());
    isSpent = await anchor.contract.isSpent(helpers.toFixedHex(deposit.nullifierHash))
    assert(isSpent);
  })
});