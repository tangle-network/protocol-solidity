/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
const assert = require('assert');
import { ethers } from 'hardhat';
const TruffleAssert = require('truffle-assertions');

// import { toFixedHex, toHex, MerkleTree, MerkleProof } from '@webb-tools/sdk-core';
import {
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  FungibleTokenWrapper as WrappedToken,
  FungibleTokenWrapper__factory as WrappedTokenFactory,
} from '@webb-tools/contracts';

import {
  hexToU8a,
  getChainIdType,
  VAnchorProofInputs,
  ZkComponents,
  u8aToHex,
  ZERO_BYTES32,
  vanchorForestFixtures,
} from '@webb-tools/utils';
import { BigNumber, ContractReceipt } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
  Keypair,
  MerkleTree,
  randomBN,
  toFixedHex,
  generateVariableWitnessInput,
  getVAnchorExtDataHash,
  generateWithdrawProofCallData,
  CircomUtxo,
  toHex,
} from '@webb-tools/sdk-core';
import { VAnchorForest, PoseidonHasher } from '@webb-tools/anchors';
import { ForestVerifier } from '@webb-tools/anchors';

import { startGanacheServer } from '../startGanache';

const BN = require('bn.js');
const path = require('path');
const snarkjs = require('snarkjs');
const { toBN } = require('web3-utils');

describe.skip('VAnchorForest for 1 max edge', () => {
  let anchor: VAnchorForest;

  const subtreeLevels = 30;
  const forestLevels = 5;
  let fee = BigInt(new BN(`100000000000000000`).toString());
  let recipient = '0x1111111111111111111111111111111111111111';
  let verifier: ForestVerifier;
  let token: ERC20PresetMinterPauser;
  let wrappedToken: WrappedToken;
  let tokenDenomination = '1000000000000000000'; // 1 ether
  const relayer = '0x2111111111111111111111111111111111111111';
  const chainID = getChainIdType(31337);
  const MAX_EDGES = 1;
  let create2InputWitness: any;
  let sender: SignerWithAddress;
  let zkComponents2_2: ZkComponents;
  let zkComponents16_2: ZkComponents;

  const generateUTXOForTest = async (chainId: number, amount?: number) => {
    const randomKeypair = new Keypair();
    const amountString = amount ? amount.toString() : '0';

    return CircomUtxo.generateUtxo({
      curve: 'Bn254',
      backend: 'Circom',
      chainId: chainId.toString(),
      originChainId: chainId.toString(),
      amount: amountString,
      blinding: hexToU8a(randomBN(31).toHexString()),
      keypair: randomKeypair,
    });
  };

  before('instantiate zkcomponents', async () => {
    zkComponents2_2 = await vanchorForestFixtures[22]();
    zkComponents16_2 = await vanchorForestFixtures[162]();
  });

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    // create poseidon hasher
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);

    // create bridge verifier
    verifier = await ForestVerifier.createVerifier(sender);

    // create token
    const tokenFactory = new ERC20PresetMinterPauser__factory(wallet);
    token = await tokenFactory.deploy('test token', 'TEST');
    await token.deployed();
    await token.mint(sender.address, '10000000000000000000000');

    // create wrapped token
    const name = 'webbETH';
    const symbol = 'webbETH';
    const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
    const wrappedTokenFactory = new WrappedTokenFactory(wallet);
    wrappedToken = await wrappedTokenFactory.deploy(name, symbol);
    await wrappedToken.deployed();
    await wrappedToken.initialize(
      0,
      dummyFeeRecipient,
      sender.address,
      '10000000000000000000000000',
      true,
      wallet.address
    );
    await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));

    // create Anchor
    anchor = await VAnchorForest.createVAnchor(
      verifier.contract.address,
      forestLevels,
      subtreeLevels,
      hasherInstance.contract.address,
      sender.address,
      wrappedToken.address,
      1,
      zkComponents2_2,
      zkComponents16_2,
      sender
    );

    await anchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(0), 1);
    await anchor.contract.configureMaximumDepositLimit(
      BigNumber.from(tokenDenomination).mul(1_000_000),
      2
    );

    const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
    await wrappedToken.grantRole(MINTER_ROLE, anchor.contract.address);
    await token.approve(wrappedToken.address, '1000000000000000000000000');

    create2InputWitness = async (data: any) => {
      const wtns = await zkComponents2_2.witnessCalculator.calculateWTNSBin(data, 0);
      return wtns;
    };
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      const maxEdges = await anchor.contract.maxEdges();
      assert.strictEqual(maxEdges.toString(), `${MAX_EDGES}`);
    });
  });

  describe('snark proof native verification on js side', () => {
    it('should work', async () => {
      const extAmount = 1e7;
      const aliceDepositAmount = 1e7;
      const roots = await anchor.populateRootsForProof();
      const inputs = [await generateUTXOForTest(chainID), await generateUTXOForTest(chainID)];
      const outputs = [
        await generateUTXOForTest(chainID, aliceDepositAmount),
        await generateUTXOForTest(chainID),
      ];
      const merkleProofsForInputs = inputs.map((x) => anchor.getMerkleProof(x));
      fee = BigInt(0);

      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      const extDataHash = getVAnchorExtDataHash(
        encOutput1,
        encOutput2,
        extAmount.toString(),
        BigNumber.from(fee).toString(),
        recipient,
        relayer,
        BigNumber.from(0).toString(),
        token.address
      );

      const input = await generateVariableWitnessInput(
        roots.map((root) => BigNumber.from(root)),
        chainID,
        inputs,
        outputs,
        extAmount,
        fee,
        extDataHash,
        merkleProofsForInputs
      );

      const wtns = await create2InputWitness(input);
      let res = await vanchorForestFixtures.prove_2_2(wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      const vKey = await vanchorForestFixtures.vkey_2_2();
      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, true);
    });
  });

  describe('Setting Handler/Verifier Address Negative Tests', () => {
    it('should revert (setting handler) with improper nonce', async () => {
      const signers = await ethers.getSigners();
      await TruffleAssert.reverts(
        anchor.contract.setHandler(signers[1].address, 0),
        'ProposalNonceTracker: Invalid nonce'
      );
      await TruffleAssert.reverts(
        anchor.contract.setHandler(signers[1].address, 4),
        'ProposalNonceTracker: Nonce must not increment more than 1'
      );
    });

    it('should revert (setting verifier) with improper nonce', async () => {
      const signers = await ethers.getSigners();
      await TruffleAssert.reverts(
        anchor.contract.setVerifier(signers[1].address, 0),
        'ProposalNonceTracker: Invalid nonce'
      );
      await TruffleAssert.reverts(
        anchor.contract.setVerifier(signers[1].address, 4),
        'ProposalNonceTracker: Nonce must not increment more than 1'
      );
    });
  });

  describe('#transact', () => {
    it('should transact', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [],
        [aliceDepositUtxo],
        0,
        0,
        '0',
        '0',
        token.address,
        {}
      );
    });

    it('should process fee on deposit', async () => {
      const signers = await ethers.getSigners();
      const alice = signers[0];

      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);
      //Step 1: Alice deposits into Tornado Pool
      const aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
      const fee = 1e6;
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [await generateUTXOForTest(chainID), await generateUTXOForTest(chainID)],
        [aliceDepositUtxo, await generateUTXOForTest(chainID)],
        BigNumber.from(fee),
        BigNumber.from(0),
        '0',
        relayer,
        token.address,
        {}
      );

      //Step 2: Check Alice's balance
      const aliceBalanceAfterDeposit = await token.balanceOf(alice.address);
      assert.strictEqual(
        aliceBalanceAfterDeposit.toString(),
        BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount)).sub(toBN(fee))).toString()
      );

      //Step 3 Check relayers balance
      assert.strictEqual(
        (await wrappedToken.balanceOf(relayer)).toString(),
        BigNumber.from(fee).toString()
      );
    });

    it('should spend input utxo and create output utxo', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [],
        [aliceDepositUtxo],
        0,
        0,
        '0',
        '0',
        token.address,
        {}
      );

      const aliceRefreshUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: BigNumber.from(chainID).toString(),
        originChainId: BigNumber.from(chainID).toString(),
        amount: BigNumber.from(aliceDepositAmount).toString(),
        blinding: hexToU8a(randomBN().toHexString()),
        keypair: aliceDepositUtxo.keypair,
      });

      await anchor.transact([aliceDepositUtxo], [aliceRefreshUtxo], 0, 0, '0', '0', '', {}, {});
    });

    it('should generate proof correctly from leavesMap', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [],
        [aliceDepositUtxo],
        0,
        0,
        '0',
        '0',
        token.address,
        {}
      );

      const aliceRefreshUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: BigNumber.from(chainID).toString(),
        originChainId: BigNumber.from(chainID).toString(),
        amount: BigNumber.from(aliceDepositAmount).toString(),
        blinding: hexToU8a(randomBN().toHexString()),
        keypair: aliceDepositUtxo.keypair,
      });

      const subtreeLeaves = anchor.tree
        .elements()
        .map((el: BigNumber) => hexToU8a(el.toHexString()));
      const forestLeaves = anchor.forest
        .elements()
        .map((el: BigNumber) => hexToU8a(el.toHexString()));
      const txOptions = { treeChainId: chainID.toString(), externalLeaves: forestLeaves };

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceRefreshUtxo],
        0,
        0,
        '0',
        '0',
        '',
        { [chainID]: subtreeLeaves },
        txOptions
        // { treeChainId: chainID.toString(), forestLeaves }
      );
    });

    it('should spend input utxo and split', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 10;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [],
        [aliceDepositUtxo],
        0,
        0,
        '0',
        '0',
        token.address,
        {}
      );

      const aliceSplitAmount = 5;
      const aliceSplitUtxo1 = await generateUTXOForTest(chainID, aliceSplitAmount);
      const aliceSplitUtxo2 = await generateUTXOForTest(chainID, aliceSplitAmount);

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceSplitUtxo1, aliceSplitUtxo2],
        0,
        0,
        '0',
        '0',
        '',
        {},
        {}
      );
    });

    it('should join and spend', async () => {
      const aliceDepositAmount1 = 1e7;
      let aliceDepositUtxo1 = await generateUTXOForTest(chainID, aliceDepositAmount1);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo1.keypair.toString(),
        [],
        [aliceDepositUtxo1],
        0,
        0,
        '0',
        '0',
        token.address,
        {}
      );

      let anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      const aliceDepositAmount2 = 1e7;
      let aliceDepositUtxo2 = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: BigNumber.from(aliceDepositAmount2).toString(),
        keypair: aliceDepositUtxo1.keypair,
        blinding: hexToU8a(randomBN().toHexString()),
      });

      await anchor.transact([], [aliceDepositUtxo2], 0, 0, '0', '0', token.address, {}, {});

      anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      const aliceJoinAmount = 2e7;
      const aliceJoinUtxo = await generateUTXOForTest(chainID, aliceJoinAmount);

      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDeposit1Index = anchor.tree.getIndexByElement(aliceDepositUtxo1.commitment);
      const aliceDeposit2Index = anchor.tree.getIndexByElement(aliceDepositUtxo2.commitment);
      aliceDepositUtxo1.setIndex(aliceDeposit1Index);
      aliceDepositUtxo2.setIndex(aliceDeposit2Index);

      await anchor.transact(
        [aliceDepositUtxo1, aliceDepositUtxo2],
        [aliceJoinUtxo],
        0,
        0,
        '0',
        '0',
        '',
        {},
        {}
      );
    });

    it('should join and spend with 16 inputs', async () => {
      const aliceDepositAmount1 = 1e7;
      let aliceDepositUtxo1 = await generateUTXOForTest(chainID, aliceDepositAmount1);
      const aliceDepositAmount2 = 1e7;
      let aliceDepositUtxo2 = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount2.toString(),
        keypair: aliceDepositUtxo1.keypair,
      });

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo1.keypair.toString(),
        [],
        [aliceDepositUtxo1, aliceDepositUtxo2],
        0,
        0,
        '0',
        '0',
        token.address,
        {}
      );

      const aliceDepositAmount3 = 1e7;
      let aliceDepositUtxo3 = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: BigNumber.from(aliceDepositAmount3).toString(),
        keypair: aliceDepositUtxo1.keypair,
      });

      await anchor.transact([], [aliceDepositUtxo3], 0, 0, '0', '0', token.address, {}, {});

      const aliceJoinAmount = 3e7;
      const aliceJoinUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: BigNumber.from(aliceJoinAmount).toString(),
        keypair: aliceDepositUtxo1.keypair,
      });

      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDeposit1Index = anchor.tree.getIndexByElement(aliceDepositUtxo1.commitment);
      const aliceDeposit2Index = anchor.tree.getIndexByElement(aliceDepositUtxo2.commitment);
      const aliceDeposit3Index = anchor.tree.getIndexByElement(aliceDepositUtxo3.commitment);
      aliceDepositUtxo1.setIndex(aliceDeposit1Index);
      aliceDepositUtxo2.setIndex(aliceDeposit2Index);
      aliceDepositUtxo3.setIndex(aliceDeposit3Index);

      await anchor.transact(
        [aliceDepositUtxo1, aliceDepositUtxo2, aliceDepositUtxo3],
        [aliceJoinUtxo],
        0,
        0,
        '0',
        '0',
        '',
        {}
      );
    }).timeout(120000);

    it('should withdraw', async () => {
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [],
        [aliceDepositUtxo],
        0,
        0,
        '0',
        '0',
        token.address,
        {}
      );

      const aliceWithdrawAmount = 5e6;
      const aliceChangeUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceWithdrawAmount.toString(),
        keypair: aliceDepositUtxo.keypair,
      });
      const aliceETHAddress = '0xDeaD00000000000000000000000000000000BEEf';

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceChangeUtxo],
        0,
        0,
        aliceETHAddress,
        '0',
        '',
        {},
        {}
      );
      assert.strictEqual(
        aliceWithdrawAmount.toString(),
        (await wrappedToken.balanceOf(aliceETHAddress)).toString()
      );
    });

    it('should prevent double spend', async () => {
      const aliceKeypair = new Keypair();
      const aliceDepositAmount = 1e7;
      let aliceDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
        keypair: aliceKeypair,
      });

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [],
        [aliceDepositUtxo],
        0,
        0,
        '0',
        '0',
        token.address,
        {}
      );

      let anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));
      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDepositIndex = anchor.tree.getIndexByElement(aliceDepositUtxo.commitment);
      aliceDepositUtxo.setIndex(aliceDepositIndex);

      const aliceTransferUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
        keypair: aliceDepositUtxo.keypair,
      });

      await anchor.transact([aliceDepositUtxo], [aliceTransferUtxo], 0, 0, '0', '0', '', {}, {});

      anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      await TruffleAssert.reverts(
        anchor.transact([aliceDepositUtxo], [aliceTransferUtxo], 0, 0, '0', '0', '', {}, {}),
        'Input is already spent'
      );
    });

    it('should prevent increasing UTXO amount without depositing', async () => {
      const signers = await ethers.getSigners();
      const alice = signers[0];

      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
      });
      //Step 1: Alice deposits into Tornado Pool
      const aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
      await anchor.registerAndTransact(
        alice.address,
        aliceDepositUtxo.keypair.toString(),
        [],
        [aliceDepositUtxo],
        0,
        0,
        '0',
        '0',
        token.address,
        {}
      );

      //Step 2: Check Alice's balance
      const aliceBalanceAfterDeposit = await token.balanceOf(alice.address);
      assert.strictEqual(
        aliceBalanceAfterDeposit.toString(),
        BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount))).toString()
      );

      //Step 3: Alice tries to create a UTXO with more funds than she has in her account
      const aliceOutputAmount = '100000000000000000000000';
      const aliceOutputUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceOutputAmount,
        keypair: aliceDepositUtxo.keypair,
      });
      //Step 4: Check that step 3 fails
      await TruffleAssert.reverts(
        anchor.transact(
          [aliceDepositUtxo],
          [aliceOutputUtxo],
          0,
          0,
          '0',
          '0',
          token.address,
          {},
          {}
        ),
        'ERC20: transfer amount exceeds balance'
      );
    });

    it('should reject tampering with public inputs', async () => {
      const relayer = '0x2111111111111111111111111111111111111111';
      const extAmount = 1e7;
      const aliceDepositAmount = 1e7;
      const roots = await anchor.populateRootsForProof();
      const inputs = [await generateUTXOForTest(chainID), await generateUTXOForTest(chainID)];
      const outputs = [
        await generateUTXOForTest(chainID, aliceDepositAmount),
        await generateUTXOForTest(chainID),
      ];
      const merkleProofsForInputs = inputs.map((x) => anchor.getMerkleProof(x));
      fee = BigInt(0);

      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      const extDataHash = getVAnchorExtDataHash(
        encOutput1,
        encOutput2,
        extAmount.toString(),
        BigNumber.from(fee).toString(),
        recipient,
        relayer,
        BigNumber.from(0).toString(),
        token.address
      );

      const input = await generateVariableWitnessInput(
        roots.map((root) => BigNumber.from(root)),
        chainID,
        inputs,
        outputs,
        extAmount,
        fee,
        extDataHash,
        merkleProofsForInputs
      );

      const wtns = await create2InputWitness(input);
      let res = await vanchorForestFixtures.prove_2_2(wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      const proofEncoded = generateWithdrawProofCallData(proof, publicSignals);

      //correct public inputs
      let publicInputArgs: [string, string, string[], [any, any], string, string] = [
        `0x${proofEncoded}`,
        VAnchorForest.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(x)),
        [toFixedHex(input.outputCommitment[0]), toFixedHex(input.outputCommitment[1])],
        toFixedHex(input.publicAmount),
        toFixedHex(input.extDataHash),
      ];

      let extDataArgs = [
        toFixedHex(recipient, 20),
        toFixedHex(extAmount),
        toFixedHex(relayer, 20),
        toFixedHex(fee),
        toFixedHex(0),
        toFixedHex(token.address, 20),
        encOutput1,
        encOutput2,
      ];

      // public amount
      let incorrectPublicInputArgs: [string, string, string[], [any, any], string, string] = [
        `0x${proofEncoded}`,
        VAnchorForest.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(x)),
        [toFixedHex(input.outputCommitment[0]), toFixedHex(input.outputCommitment[1])],
        toFixedHex(BigNumber.from(input.publicAmount).add(1)),
        toFixedHex(input.extDataHash),
      ];

      let incorrectPublicInputs =
        VAnchorForest.convertToPublicInputsStruct(incorrectPublicInputArgs);
      let extAmountInputs = VAnchorForest.convertToExtDataStruct(extDataArgs);

      await TruffleAssert.reverts(
        anchor.contract.transact(
          incorrectPublicInputs.proof,
          ZERO_BYTES32,
          extAmountInputs,
          incorrectPublicInputs,
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          }
        ),
        'Invalid public amount'
      );

      // extdatahash
      incorrectPublicInputArgs = [
        `0x${proofEncoded}`,
        VAnchorForest.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(x)),
        [toFixedHex(input.outputCommitment[0]), toFixedHex(input.outputCommitment[1])],
        toFixedHex(input.publicAmount),
        toFixedHex(BigNumber.from(input.extDataHash).add(1)),
      ];

      incorrectPublicInputs = VAnchorForest.convertToPublicInputsStruct(incorrectPublicInputArgs);

      await TruffleAssert.reverts(
        anchor.contract.transact(
          incorrectPublicInputs.proof,
          ZERO_BYTES32,
          extAmountInputs,
          incorrectPublicInputs,
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          }
        ),
        'Incorrect external data hash'
      );

      // output commitment
      incorrectPublicInputArgs = [
        `0x${proofEncoded}`,
        VAnchorForest.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(x)),
        [
          toFixedHex(BigNumber.from(input.outputCommitment[0]).add(1)),
          toFixedHex(input.outputCommitment[1]),
        ],
        toFixedHex(input.publicAmount),
        toFixedHex(input.extDataHash),
      ];

      incorrectPublicInputs = VAnchorForest.convertToPublicInputsStruct(incorrectPublicInputArgs);

      await TruffleAssert.reverts(
        anchor.contract.transact(
          incorrectPublicInputs.proof,
          ZERO_BYTES32,
          extAmountInputs,
          incorrectPublicInputs,
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          }
        ),
        'Invalid withdraw proof'
      );

      // input nullifier
      incorrectPublicInputArgs = [
        `0x${proofEncoded}`,
        VAnchorForest.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(BigNumber.from(x).add(1))),
        [toFixedHex(input.outputCommitment[0]), toFixedHex(input.outputCommitment[1])],
        toFixedHex(input.publicAmount),
        toFixedHex(input.extDataHash),
      ];

      incorrectPublicInputs = VAnchorForest.convertToPublicInputsStruct(incorrectPublicInputArgs);

      await TruffleAssert.reverts(
        anchor.contract.transact(
          incorrectPublicInputs.proof,
          ZERO_BYTES32,
          extAmountInputs,
          incorrectPublicInputs,
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          }
        ),
        'Invalid withdraw proof'
      );

      //relayer
      let incorrectExtDataArgs = [
        toFixedHex(recipient, 20),
        toFixedHex(extAmount),
        toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
        toFixedHex(fee),
        toFixedHex(0),
        toFixedHex(token.address, 20),
        encOutput1,
        encOutput2,
      ];

      let correctPublicInputs = VAnchorForest.convertToPublicInputsStruct(publicInputArgs);
      let incorrectExtAmountInputs = VAnchorForest.convertToExtDataStruct(incorrectExtDataArgs);

      await TruffleAssert.reverts(
        anchor.contract.transact(
          correctPublicInputs.proof,
          ZERO_BYTES32,
          incorrectExtAmountInputs,
          correctPublicInputs,
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          }
        ),
        'Incorrect external data hash'
      );

      //recipient
      incorrectExtDataArgs = [
        toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
        toFixedHex(extAmount),
        toFixedHex(relayer, 20),
        toFixedHex(fee),
        toFixedHex(0),
        toFixedHex(token.address, 20),
        encOutput1,
        encOutput2,
      ];

      incorrectExtAmountInputs = VAnchorForest.convertToExtDataStruct(incorrectExtDataArgs);

      await TruffleAssert.reverts(
        anchor.contract.transact(
          correctPublicInputs.proof,
          ZERO_BYTES32,
          incorrectExtAmountInputs,
          correctPublicInputs,
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          }
        ),
        'Incorrect external data hash'
      );

      //fee
      incorrectExtDataArgs = [
        toFixedHex(recipient, 20),
        toFixedHex(extAmount),
        toFixedHex(relayer, 20),
        toFixedHex('0x000000000000000000000000000000000000000000000000015345785d8a0000'),
        toFixedHex(0),
        toFixedHex(token.address, 20),
        encOutput1,
        encOutput2,
      ];

      incorrectExtAmountInputs = VAnchorForest.convertToExtDataStruct(incorrectExtDataArgs);

      await TruffleAssert.reverts(
        anchor.contract.transact(
          correctPublicInputs.proof,
          ZERO_BYTES32,
          incorrectExtAmountInputs,
          correctPublicInputs,
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          }
        ),
        'Incorrect external data hash'
      );
    });

    // This test is meant to prove that utxo transfer flows are possible, and the receiver
    // can query on-chain data to construct and spend a utxo generated by the sender.
    it('should be able to transfer without direct communication between sender and recipient', async function () {
      const [sender, recipient] = await ethers.getSigners();
      const bobKeypair = new Keypair();

      // Get the balances before anchor interactions
      const aliceBalanceBefore = await token.balanceOf(sender.address);
      const bobBalanceBefore = await token.balanceOf(recipient.address);

      // First, Bob registers the keypair on chain.
      await anchor.setSigner(recipient);
      let tx = await anchor.contract.register({
        owner: recipient.address,
        keyData: bobKeypair.toString(),
      });
      let receipt = await tx.wait();

      // Then, alice queries the chain data for keypair information.
      // In this test, simply take the data from the previous transaction receipt.
      await anchor.setSigner(sender);
      const registeredKeydata: string = receipt.events[0].args.key;
      const bobPublicKeypair = Keypair.fromString(registeredKeydata);

      // generate a UTXO that is only spendable by bob
      const aliceTransferUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: (1e7).toString(),
        keypair: bobPublicKeypair,
      });

      // Insert the UTXO into the tree
      receipt = (await anchor.transact(
        [],
        [aliceTransferUtxo],
        0,
        0,
        '0',
        '0',
        token.address,
        {}
      )) as ContractReceipt;

      // Bob queries encrypted commitments on chain
      const encryptedCommitments: string[] = receipt.events
        .filter((event) => event.event === 'NewCommitment')
        .sort((a, b) => a.args.index - b.args.index)
        .map((e) => e.args.encryptedOutput);

      // Attempt to decrypt the encrypted commitments with bob's keypair
      const utxos = await Promise.all(
        encryptedCommitments.map(async (enc, index) => {
          try {
            const decryptedUtxo = await CircomUtxo.decrypt(bobKeypair, enc);
            // In order to properly calculate the nullifier, an index is required.
            decryptedUtxo.setIndex(index);
            decryptedUtxo.setOriginChainId(chainID.toString());
            const alreadySpent = await anchor.contract.isSpent(
              toFixedHex('0x' + decryptedUtxo.nullifier)
            );
            if (!alreadySpent) {
              return decryptedUtxo;
            } else {
              throw new Error('Passed Utxo detected as alreadySpent');
            }
          } catch (e) {
            return undefined;
          }
        })
      );

      const spendableUtxos = utxos.filter((utxo) => utxo !== undefined);

      // Bob uses the parsed utxos to issue a withdraw
      receipt = await anchor.transact(
        spendableUtxos,
        [],
        0,
        0,
        recipient.address,
        '0',
        token.address,
        {},
        {}
      );

      // get balances after transfer interactions
      const aliceBalanceAfter = await token.balanceOf(sender.address);
      const bobBalanceAfter = await token.balanceOf(recipient.address);

      assert.strictEqual(
        aliceBalanceBefore.sub(aliceBalanceAfter).toString(),
        (0 + Number(aliceTransferUtxo.amount)).toString()
      );
      assert.strictEqual(bobBalanceAfter.sub(bobBalanceBefore).toString(), '10000000');
    });

    it('should be compliant', async function () {
      // basically verifier should check if a commitment and a nullifier hash are on chain
      const [sender] = await ethers.getSigners();

      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      await anchor.transact([], [aliceDepositUtxo], 0, 0, '0', '0', token.address, {});

      // withdrawal
      await anchor.transact([aliceDepositUtxo], [], 0, 0, sender.address, '0', '', {}, {});

      //build merkle tree start
      const filter = anchor.contract.filters.NewCommitment();
      const events = await anchor.contract.queryFilter(filter, 0);

      const leaves = events
        .sort((a: any, b: any) => a.args.index - b.args.index)
        .map((e) => toFixedHex(e.args.commitment));
      const tree = new MerkleTree(subtreeLevels, leaves);

      //build merkle tree end
      const commitment = aliceDepositUtxo.commitment;
      const index = tree.indexOf(toFixedHex(commitment)); // it's the same as merklePath and merklePathIndexes and index in the tree

      aliceDepositUtxo.setIndex(index);

      // generateReport(dataForVerifier) -> compliance report
      // on the verifier side we compute commitment and nullifier and then check them onchain

      assert.strictEqual(
        BigNumber.from(aliceDepositUtxo.commitment).toString(),
        BigNumber.from(commitment).toString()
      );
      assert.strictEqual(
        await anchor.contract.nullifierHashes(toFixedHex('0x' + aliceDepositUtxo.nullifier)),
        true
      );
    });

    it('should reject proofs made against roots of empty edges', async () => {
      // This test has not been linked to another anchor - edgeList should be empty.
      await TruffleAssert.reverts(anchor.contract.edgeList(0));

      // create the UTXO for commitment into a fake tree.
      const depositAmount = 1e7;
      const fakeChainId = getChainIdType(666);
      const keypair = new Keypair();
      let fakeUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: fakeChainId.toString(),
        amount: depositAmount.toString(),
        index: '0',
        keypair,
      });
      const fakeInputs = await anchor.padUtxos([fakeUtxo], 2);
      const outputs = await anchor.padUtxos([], 2);

      const extAmount = BigNumber.from(fee)
        .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
        .sub(fakeInputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)));

      const fakeTree = new MerkleTree(subtreeLevels);
      const fakeForest = new MerkleTree(forestLevels);
      const fakeCommitment = u8aToHex(fakeUtxo.commitment);

      fakeTree.insert(fakeCommitment);
      const fakeSubtreeRoot = fakeTree.root();
      fakeForest.insert(fakeSubtreeRoot);
      const fakeRoot = fakeForest.root();
      const emptyMerkleProof = anchor.getMerkleProof(fakeInputs[1]);

      const fakeSubtreeProof = fakeTree.path(0);
      const fakeForestProof = fakeForest.path(0);
      let forestIndices = [
        MerkleTree.calculateIndexFromPathIndices(fakeForestProof.pathIndices),
        0,
      ];
      let forestPathElements = [
        fakeForestProof.pathElements.map((bignum) => bignum.toString()),
        emptyMerkleProof.forestPathElements.map((bignum: BigNumber) => bignum.toString()),
      ];
      let subtreeIndices = [
        MerkleTree.calculateIndexFromPathIndices(fakeSubtreeProof.pathIndices),
        0,
      ];

      const roots = await anchor.populateRootsForProof();
      roots[1] = fakeRoot;

      const { extData, extDataHash } = await anchor.generateExtData(
        recipient,
        BigNumber.from(extAmount),
        relayer,
        BigNumber.from(fee),
        BigNumber.from(0),
        wrappedToken.address,
        outputs[0].encrypt(),
        outputs[1].encrypt()
      );

      const merkleProofs = [fakeSubtreeProof, emptyMerkleProof];

      const vanchorInput: VAnchorProofInputs = await generateVariableWitnessInput(
        roots.map((root) => BigNumber.from(root)),
        chainID,
        fakeInputs,
        outputs,
        extAmount,
        fee,
        BigNumber.from(extDataHash),
        merkleProofs
      );

      const proofInput = {
        roots: vanchorInput.roots,
        chainID: vanchorInput.chainID,
        inputNullifier: vanchorInput.inputNullifier.map((hexStr) =>
          BigNumber.from(hexStr).toString()
        ),
        outputCommitment: vanchorInput.outputCommitment,
        publicAmount: vanchorInput.publicAmount,
        extDataHash: vanchorInput.extDataHash,
        inAmount: vanchorInput.inAmount,
        inPrivateKey: vanchorInput.inPrivateKey,
        inBlinding: vanchorInput.inBlinding,
        outChainID: vanchorInput.outChainID,
        outAmount: vanchorInput.outAmount,
        outPubkey: vanchorInput.outPubkey,
        outBlinding: vanchorInput.outBlinding,
        //
        //
        subtreePathIndices: subtreeIndices,
        subtreePathElements: vanchorInput.inPathElements.map((utxoPathElements) =>
          utxoPathElements.map((bignum) => bignum.toString())
        ),
        forestPathIndices: forestIndices,
        forestPathElements,
      };

      const wasmFile = anchor.smallCircuitZkComponents.wasm;
      const zkeyFile = anchor.smallCircuitZkComponents.zkey;

      let proof = await snarkjs.groth16.fullProve(proofInput, wasmFile, zkeyFile);
      const vKey = await vanchorForestFixtures.vkey_2_2();

      const res = await snarkjs.groth16.verify(vKey, proof.publicSignals, proof.proof);
      if (res !== true) {
        throw new Error('!!!!!!!!!!!!!!!!!!!!!!!!!!Invalid proof');
      }

      const publicInputs = await anchor.generatePublicInputs(proof);
      await TruffleAssert.reverts(
        anchor.contract.transact(
          publicInputs.proof,
          ZERO_BYTES32,
          {
            recipient: extData.recipient,
            extAmount: extData.extAmount,
            relayer: extData.relayer,
            fee: extData.fee,
            refund: extData.refund,
            token: extData.token,
          },
          {
            roots: publicInputs.roots,
            extensionRoots: '0x',
            inputNullifiers: publicInputs.inputNullifiers,
            outputCommitments: [
              publicInputs.outputCommitments[0],
              publicInputs.outputCommitments[1],
            ],
            publicAmount: publicInputs.publicAmount,
            extDataHash: publicInputs.extDataHash,
          },
          {
            encryptedOutput1: extData.encryptedOutput1,
            encryptedOutput2: extData.encryptedOutput2,
          },
          { gasLimit: '0x5B8D80' }
        ),
        'LinkableAnchor: non-existent edge is not set to the default root'
      );
    });
  });
  describe('#wrapping tests', () => {
    it('should wrap and deposit', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;

      // create poseidon hasher
      const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);

      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol);
      await wrappedToken.deployed();
      await wrappedToken.initialize(
        0,
        dummyFeeRecipient,
        sender.address,
        '10000000000000000000000000',
        true,
        wallet.address
      );
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));

      // create Anchor for wrapped token
      const wrappedAnchor = await VAnchorForest.createVAnchor(
        verifier.contract.address,
        forestLevels,
        subtreeLevels,
        hasherInstance.contract.address,
        sender.address,
        wrappedToken.address,
        1,
        zkComponents2_2,
        zkComponents16_2,
        sender
      );

      await wrappedAnchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(0), 1);
      await wrappedAnchor.contract.configureMaximumDepositLimit(
        BigNumber.from(tokenDenomination).mul(1_000_000),
        2
      );

      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await wrappedToken.grantRole(MINTER_ROLE, wrappedAnchor.contract.address);

      await token.approve(wrappedToken.address, '1000000000000000000');
      const balTokenBeforeDepositSender = await token.balanceOf(sender.address);

      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
        keypair: new Keypair(),
        index: null,
      });
      //create a deposit on the anchor already setup
      await wrappedAnchor.transact([], [aliceDepositUtxo], '0', '0', '0', '0', token.address, {});
      const balTokenAfterDepositSender = await token.balanceOf(sender.address);
      assert.strictEqual(
        balTokenBeforeDepositSender.sub(balTokenAfterDepositSender).toString(),
        '10000000'
      );

      const balWrappedTokenAfterDepositAnchor = await wrappedToken.balanceOf(
        wrappedAnchor.contract.address
      );
      const balWrappedTokenAfterDepositSender = await wrappedToken.balanceOf(sender.address);
      assert.strictEqual(balWrappedTokenAfterDepositAnchor.toString(), '10000000');
      assert.strictEqual(balWrappedTokenAfterDepositSender.toString(), '0');
    });

    it.skip('verify storage value of latest leaf index', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;

      // create poseidon hasher
      const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);

      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol);
      await wrappedToken.deployed();
      await wrappedToken.initialize(
        0,
        dummyFeeRecipient,
        sender.address,
        '10000000000000000000000000',
        true,
        wallet.address
      );
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));

      // create Anchor for wrapped token
      const wrappedAnchor = await VAnchorForest.createVAnchor(
        verifier.contract.address,
        forestLevels,
        subtreeLevels,
        hasherInstance.contract.address,
        sender.address,
        wrappedToken.address,
        1,
        zkComponents2_2,
        zkComponents16_2,
        sender
      );

      await wrappedAnchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(0), 1);
      await wrappedAnchor.contract.configureMaximumDepositLimit(
        BigNumber.from(tokenDenomination).mul(1_000_000),
        2
      );

      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await wrappedToken.grantRole(MINTER_ROLE, wrappedAnchor.contract.address);

      await token.approve(wrappedToken.address, '1000000000000000000');
      const aliceDepositAmount = 1e7;
      const numOfInsertions = 31;
      for (let i = 0; i < numOfInsertions; i++) {
        const aliceDepositUtxo = await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainID.toString(),
          originChainId: chainID.toString(),
          amount: aliceDepositAmount.toString(),
          keypair: new Keypair(),
          index: null,
        });
        // create a deposit on the anchor already setup
        await wrappedAnchor.transact([], [aliceDepositUtxo], '0', '0', '0', '0', token.address, {});
      }

      assert.equal(
        BigNumber.from(numOfInsertions * 2).toString(),
        BigNumber.from(
          await ethers.provider.getStorageAt(
            wrappedAnchor.contract.address,
            '0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b6887930'
          )
        ).toString()
      );
    }).timeout(12000000);

    it('should withdraw and unwrap', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;

      // create poseidon hasher
      const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);

      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol);
      await wrappedToken.deployed();
      await wrappedToken.initialize(
        0,
        dummyFeeRecipient,
        sender.address,
        '10000000000000000000000000',
        true,
        wallet.address
      );
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));

      // create Anchor for wrapped token
      const wrappedVAnchor = await VAnchorForest.createVAnchor(
        verifier.contract.address,
        forestLevels,
        subtreeLevels,
        hasherInstance.contract.address,
        sender.address,
        wrappedToken.address,
        1,
        zkComponents2_2,
        zkComponents16_2,
        sender
      );

      await wrappedVAnchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(0), 1);
      await wrappedVAnchor.contract.configureMaximumDepositLimit(
        BigNumber.from(tokenDenomination).mul(1_000_000),
        2
      );

      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await wrappedToken.grantRole(MINTER_ROLE, wrappedVAnchor.contract.address);
      await token.approve(wrappedToken.address, '1000000000000000000');
      //Check that VAnchorForest has the right amount of wrapped token balance
      assert.strictEqual(
        (await wrappedToken.balanceOf(wrappedVAnchor.contract.address)).toString(),
        BigNumber.from(0).toString()
      );
      const balTokenBeforeDepositSender = await token.balanceOf(sender.address);
      const aliceDepositAmount = 1e7;
      const keypair = new Keypair();
      let aliceDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
        keypair,
      });
      //create a deposit on the anchor already setup
      await wrappedVAnchor.transact([], [aliceDepositUtxo], 0, 0, '0', '0', token.address, {});

      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDepositIndex = wrappedVAnchor.tree.getIndexByElement(aliceDepositUtxo.commitment);
      aliceDepositUtxo.setIndex(aliceDepositIndex);

      //Check that VAnchorForest has the right amount of wrapped token balance
      assert.strictEqual(
        (await wrappedToken.balanceOf(wrappedVAnchor.contract.address)).toString(),
        BigNumber.from(1e7).toString()
      );

      const aliceChangeAmount = 0;
      const aliceChangeUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceChangeAmount.toString(),
      });

      await wrappedVAnchor.transact(
        [aliceDepositUtxo],
        [aliceChangeUtxo],
        0,
        0,
        sender.address,
        '0',
        token.address,
        {},
        {}
      );

      const balTokenAfterWithdrawAndUnwrapSender = await token.balanceOf(sender.address);
      assert.strictEqual(
        balTokenBeforeDepositSender.toString(),
        balTokenAfterWithdrawAndUnwrapSender.toString()
      );
    });

    it('wrapping fee should work correctly with transact', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;

      // create poseidon hasher
      const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);

      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = '0x0000000000000000010000000000000000000000';
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol);
      await wrappedToken.deployed();
      await wrappedToken.initialize(
        0,
        dummyFeeRecipient,
        sender.address,
        '10000000000000000000000000',
        true,
        wallet.address
      );
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
      const wrapFee = 5;
      await wrappedToken.setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1));

      // create Anchor for wrapped token
      const wrappedVAnchor = await VAnchorForest.createVAnchor(
        verifier.contract.address,
        forestLevels,
        subtreeLevels,
        hasherInstance.contract.address,
        sender.address,
        wrappedToken.address,
        1,
        zkComponents2_2,
        zkComponents16_2,
        sender
      );

      await wrappedVAnchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(0), 1);
      await wrappedVAnchor.contract.configureMaximumDepositLimit(
        BigNumber.from(tokenDenomination).mul(1_000_000),
        2
      );

      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await wrappedToken.grantRole(MINTER_ROLE, wrappedVAnchor.contract.address);

      await token.approve(wrappedToken.address, '10000000000000000000');

      //Should take a fee when depositing
      //Deposit 2e7 and Check Relevant Balances
      const aliceDepositAmount = 2e7;
      let aliceDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
      });

      const balUnwrappedTokenBeforeDepositSender = await token.balanceOf(sender.address);
      const balUnwrappedTokenBeforeDepositWrapper = await token.balanceOf(wrappedToken.address);

      await wrappedVAnchor.transact([], [aliceDepositUtxo], 0, 0, '0', '0', token.address, {});

      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDepositIndex = wrappedVAnchor.tree.getIndexByElement(aliceDepositUtxo.commitment);
      aliceDepositUtxo.setIndex(aliceDepositIndex);

      // Balance of VAnchorForest wrapped token should be 2e7
      const balWrappedTokenAfterDepositAnchor = await wrappedToken.balanceOf(
        wrappedVAnchor.contract.address
      );
      assert.strictEqual(
        balWrappedTokenAfterDepositAnchor.toString(),
        BigNumber.from(2e7).toString()
      );

      // Balance of sender unwrapped token should have gone down by 2e7 * (100) / (100 - wrapFee);
      const expectedSenderTokenOutflows = Math.trunc((2e7 * 10000) / (10000 - wrapFee));
      const balUnwrappedTokenAfterDepositSender = await token.balanceOf(sender.address);
      assert.strictEqual(
        balUnwrappedTokenBeforeDepositSender.sub(balUnwrappedTokenAfterDepositSender).toString(),
        expectedSenderTokenOutflows.toString()
      );

      // Balance of TokenWrapper unwrapped should have gone up by 2e7
      const balUnwrappedTokenAfterDepositWrapper = await token.balanceOf(wrappedToken.address);
      assert.strictEqual(
        balUnwrappedTokenAfterDepositWrapper.sub(balUnwrappedTokenBeforeDepositWrapper).toString(),
        BigNumber.from(2e7).toString()
      );

      // Withdraw 1e7 and check relevant balances
      const aliceWithdrawAmount = 1e7;
      let anchorLeaves = wrappedVAnchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      let aliceChangeUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceWithdrawAmount.toString(),
        keypair: aliceDepositUtxo.keypair,
      });

      await wrappedVAnchor.transact(
        [aliceDepositUtxo],
        [aliceChangeUtxo],
        0,
        0,
        sender.address,
        '0',
        token.address,
        {},
        {}
      );

      anchorLeaves = wrappedVAnchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));
      const aliceChangeIndex = wrappedVAnchor.tree.getIndexByElement(aliceChangeUtxo.commitment);
      aliceChangeUtxo.setIndex(aliceChangeIndex);

      const balUnwrappedTokenAfterWithdrawSender = await token.balanceOf(sender.address);
      assert.strictEqual(
        balUnwrappedTokenAfterWithdrawSender.sub(balUnwrappedTokenAfterDepositSender).toString(),
        BigNumber.from(1e7).toString()
      );

      const balWrappedTokenAfterWithdrawAnchor = await wrappedToken.balanceOf(
        wrappedVAnchor.contract.address
      );
      assert.strictEqual(
        balWrappedTokenAfterDepositAnchor.sub(balWrappedTokenAfterWithdrawAnchor).toString(),
        BigNumber.from(1e7).toString()
      );

      const balUnwrappedTokenAfterWithdrawWrapper = await token.balanceOf(wrappedToken.address);
      assert.strictEqual(
        balUnwrappedTokenAfterDepositWrapper.sub(balUnwrappedTokenAfterWithdrawWrapper).toString(),
        BigNumber.from(1e7).toString()
      );

      await TruffleAssert.passes(
        wrappedVAnchor.transact(
          [aliceChangeUtxo],
          [],
          0,
          0,
          sender.address,
          '0',
          token.address,
          {},
          {}
        )
      );

      let originalTokenDifference = expectedSenderTokenOutflows - 2e7;

      assert.strictEqual(
        (await token.balanceOf(sender.address)).toString(),
        balUnwrappedTokenBeforeDepositSender.sub(originalTokenDifference).toString()
      );
    });

    it('non-handler setting fee should fail', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;
      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol);
      await wrappedToken.deployed();
      await wrappedToken.initialize(
        0,
        dummyFeeRecipient,
        sender.address,
        '10000000000000000000000000',
        true,
        wallet.address
      );
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
      const wrapFee = 5;
      const otherSender = signers[1];
      await TruffleAssert.reverts(
        wrappedToken
          .connect(otherSender)
          .setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1)),
        'FungibleTokenWrapper: Only handler can call this function'
      );
    });

    it('fee percentage cannot be greater than 10000', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;
      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol);
      await wrappedToken.deployed();
      await wrappedToken.initialize(
        0,
        dummyFeeRecipient,
        sender.address,
        '10000000000000000000000000',
        true,
        wallet.address
      );
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
      const wrapFee = 10001;
      assert;
      await TruffleAssert.reverts(
        wrappedToken.setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1)),
        'FungibleTokenWrapper: Invalid fee percentage'
      );
    });

    it('fee percentage cannot be negative', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;
      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol);
      await wrappedToken.deployed();
      await wrappedToken.initialize(
        0,
        dummyFeeRecipient,
        sender.address,
        '10000000000000000000000000',
        true,
        wallet.address
      );
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
      const wrapFee = -1;
      assert;
      await TruffleAssert.fails(
        wrappedToken.setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1))
      );
    });

    it('fee percentage cannot be non-integer', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;
      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol);
      await wrappedToken.deployed();
      await wrappedToken.initialize(
        0,
        dummyFeeRecipient,
        sender.address,
        '10000000000000000000000000',
        true,
        wallet.address
      );
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
      const wrapFee = 2.5;
      assert;
      await TruffleAssert.fails(
        wrappedToken.setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1))
      );
    });
    describe('#cross-chain test', () => {
      const SECOND_CHAIN_ID = 10010;
      const chainID2 = getChainIdType(SECOND_CHAIN_ID);
      let ganacheServer: any;
      let ganacheAnchor: VAnchorForest;
      let ganacheProvider = new ethers.providers.JsonRpcProvider(
        `http://localhost:${SECOND_CHAIN_ID}`
      );
      ganacheProvider.pollingInterval = 1;
      let ganacheWallet = new ethers.Wallet(
        'c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e',
        ganacheProvider
      );

      let ganacheVerifier: ForestVerifier;
      let ganacheToken: ERC20PresetMinterPauser;
      let ganacheWrappedToken: WrappedToken;

      before('start ganache server', async () => {
        ganacheServer = await startGanacheServer(SECOND_CHAIN_ID, SECOND_CHAIN_ID, [
          {
            balance: '0x1000000000000000000000',
            secretKey: '0xc0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e',
          },
        ]);
        await ganacheProvider.ready;
      });
      beforeEach(async () => {
        const ganacheHasherInstance = await PoseidonHasher.createPoseidonHasher(ganacheWallet);

        // create bridge verifier
        ganacheVerifier = await ForestVerifier.createVerifier(ganacheWallet);

        // create token
        const tokenFactory = new ERC20PresetMinterPauser__factory(ganacheWallet);
        ganacheToken = await tokenFactory.deploy('test token 2', 'TEST 2');
        await ganacheToken.deployed();
        await ganacheToken.mint(ganacheWallet.address, '10000000000000000000000');

        // create wrapped token
        const name = 'webbETH2';
        const symbol = 'webbETH2';
        const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
        const wrappedTokenFactory = new WrappedTokenFactory(ganacheWallet);
        ganacheWrappedToken = await wrappedTokenFactory.deploy(name, symbol);
        await ganacheWrappedToken.deployed();
        await ganacheWrappedToken.initialize(
          0,
          dummyFeeRecipient,
          ganacheWallet.address,
          '10000000000000000000000000',
          true,
          ganacheWallet.address
        );
        await ganacheWrappedToken.add(
          ganacheToken.address,
          (await ganacheWrappedToken.proposalNonce()).add(1)
        );

        // create Anchor
        ganacheAnchor = await VAnchorForest.createVAnchor(
          ganacheVerifier.contract.address,
          forestLevels,
          subtreeLevels,
          ganacheHasherInstance.contract.address,
          ganacheWallet.address,
          ganacheWrappedToken.address,
          1,
          zkComponents2_2,
          zkComponents16_2,
          ganacheWallet
        );

        await ganacheAnchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(0), 1);
        await ganacheAnchor.contract.configureMaximumDepositLimit(
          BigNumber.from(tokenDenomination).mul(1_000_000),
          2
        );

        const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
        await ganacheWrappedToken.grantRole(MINTER_ROLE, ganacheAnchor.contract.address);
        await ganacheToken.approve(ganacheWrappedToken.address, '1000000000000000000000000');
      });
      it('should initialize', async () => {
        const maxEdges = await ganacheAnchor.contract.maxEdges();
        assert.strictEqual(maxEdges.toString(), `${MAX_EDGES}`);
      });
      it('should transact', async () => {
        // Alice deposits into tornado pool
        const aliceKeypair = new Keypair();
        const aliceDepositAmount = 1e7;
        // const aliceDepositUtxo = await generateUTXOForTest(chainID2, aliceDepositAmount);
        const aliceDepositUtxo = await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainID2.toString(),
          originChainId: chainID2.toString(),
          amount: aliceDepositAmount.toString(),
          keypair: aliceKeypair,
        });
        const aliceBalanceBeforeDeposit = await ganacheToken.balanceOf(ganacheWallet.address);

        ganacheAnchor.setSigner(ganacheWallet);
        await ganacheAnchor.registerAndTransact(
          ganacheWallet.address,
          aliceDepositUtxo.keypair.toString(),
          [],
          [aliceDepositUtxo],
          0,
          0,
          '0',
          '0',
          ganacheToken.address,
          {},
          { gasLimit: '0x5B8D80' }
        );
        const aliceBalanceAfterDeposit = await ganacheToken.balanceOf(ganacheWallet.address);
        assert.strictEqual(
          aliceBalanceBeforeDeposit.sub(aliceDepositAmount).toString(),
          aliceBalanceAfterDeposit.toString()
        );
      });
      it('should cross chain withdraw', async () => {
        // Alice deposits into tornado pool
        const aliceKeypair = new Keypair();
        const aliceDepositAmount = 1e7;
        // const aliceDepositUtxo = await generateUTXOForTest(chainID2, aliceDepositAmount);
        const aliceDepositUtxo = await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainID.toString(),
          originChainId: chainID2.toString(),
          amount: aliceDepositAmount.toString(),
          keypair: aliceKeypair,
        });
        const aliceBalanceBeforeDeposit = await ganacheToken.balanceOf(ganacheWallet.address);

        ganacheAnchor.setSigner(ganacheWallet);
        await ganacheAnchor.registerAndTransact(
          ganacheWallet.address,
          aliceDepositUtxo.keypair.toString(),
          [],
          [aliceDepositUtxo],
          0,
          0,
          '0',
          '0',
          ganacheToken.address,
          {},
          { gasLimit: '0x5B8D80' }
        );
        const aliceBalanceAfterDeposit = await ganacheToken.balanceOf(ganacheWallet.address);
        // making a deposit or the vanchor will not have enough tokens to withdraw
        const bobKeypair = new Keypair();
        // const aliceDepositUtxo = await generateUTXOForTest(chainID2, aliceDepositAmount);
        const bobDepositUtxo = await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainID.toString(),
          originChainId: chainID.toString(),
          amount: aliceDepositAmount.toString(),
          keypair: bobKeypair,
        });
        const bobBalanceBeforeDeposit = await token.balanceOf(sender.address);

        ganacheAnchor.setSigner(sender);
        await anchor.registerAndTransact(
          sender.address,
          bobDepositUtxo.keypair.toString(),
          [],
          [bobDepositUtxo],
          0,
          0,
          '0',
          '0',
          token.address,
          {}
        );
        const bobBalanceAfterDeposit = await token.balanceOf(sender.address);
        assert.strictEqual(
          bobBalanceBeforeDeposit.sub(aliceDepositAmount).toString(),
          bobBalanceAfterDeposit.toString()
        );

        const aliceWithdrawAmount = 5e6;
        const aliceChangeUtxo = await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainID2.toString(),
          originChainId: chainID2.toString(),
          amount: aliceWithdrawAmount.toString(),
          keypair: aliceDepositUtxo.keypair,
        });
        const resourceId = toHex(ganacheAnchor.contract.address + toHex(chainID, 6).substr(2), 32);

        const subtreeLeaves = ganacheAnchor.tree
          .elements()
          .map((el: BigNumber) => hexToU8a(el.toHexString()));
        const forestLeaves = ganacheAnchor.forest
          .elements()
          .map((el: BigNumber) => hexToU8a(el.toHexString()));
        const txOptions = {
          treeChainId: chainID2.toString(),
          externalLeaves: forestLeaves,
          gasLimit: '0x5B8D80',
        };
        const contractRoot = await ganacheAnchor.contract.getLastRoot();

        const tx = await anchor.contract.updateEdge(contractRoot, 0, resourceId);
        const receipt = await tx.wait();

        assert.strictEqual(
          aliceBalanceBeforeDeposit.sub(aliceDepositAmount).toString(),
          aliceBalanceAfterDeposit.toString()
        );
        await anchor.registerAndTransact(
          sender.address,
          aliceDepositUtxo.keypair.toString(),
          [aliceDepositUtxo],
          [aliceChangeUtxo],
          0,
          0,
          sender.address,
          '0',
          token.address,
          { [chainID2]: subtreeLeaves },
          txOptions
          // { treeChainId: chainID.toString(), forestLeaves }
        );
        // const aliceBalanceFinal = await token.balanceOf(sender.address);
        // assert.strictEqual(aliceBalanceAfterDeposit.add(aliceWithdrawAmount).toString(), aliceBalanceFinal.toString())
      });
      after('terminate networks', async () => {
        await ganacheServer.close();
      });
    });
  });
});
