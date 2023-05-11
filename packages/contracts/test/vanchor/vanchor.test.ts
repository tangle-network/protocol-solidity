/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
const assert = require('assert');
import { ethers } from 'hardhat';
const TruffleAssert = require('truffle-assertions');

import {
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  FungibleTokenWrapper as WrappedToken,
  FungibleTokenWrapper__factory as WrappedTokenFactory,
} from '@webb-tools/contracts';

import {
  hexToU8a,
  getChainIdType,
  ZkComponents,
  u8aToHex,
  ZERO_BYTES32,
  vanchorFixtures,
} from '@webb-tools/utils';
import { BigNumber, ContractReceipt } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
  Utxo,
  Keypair,
  MerkleTree,
  randomBN,
  toFixedHex,
  generateVariableWitnessInput,
  getVAnchorExtDataHash,
  generateWithdrawProofCallData,
  CircomUtxo,
} from '@webb-tools/sdk-core';
import { VAnchor, PoseidonHasher } from '@webb-tools/anchors';
import { Verifier } from '@webb-tools/anchors';
import { SetupTxVAnchorMock } from './mocks/SetupTxVAnchorMock';
import { retryPromiseMock } from './mocks/retryPromiseMock';

const BN = require('bn.js');

const path = require('path');
const snarkjs = require('snarkjs');
const { toBN } = require('web3-utils');

describe.only('VAnchor for 1 max edge', () => {
  let anchor: VAnchor;

  const levels = 30;
  let fee = BigInt(new BN(`100000000000000000`).toString());
  let recipient;
  let verifier: Verifier;
  let token: ERC20PresetMinterPauser;
  let wrappedToken: WrappedToken;
  let tokenDenomination = '1000000000000000000'; // 1 ether
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
    zkComponents2_2 = await vanchorFixtures[22]();
    zkComponents16_2 = await vanchorFixtures[162]();
  });

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    recipient = signers[1].address;
    // create poseidon hasher
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);

    // create bridge verifier
    verifier = await Verifier.createVerifier(sender);

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
    anchor = await VAnchor.createVAnchor(
      verifier.contract.address,
      levels,
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
      const relayer = '0x2111111111111111111111111111111111111111';
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

      const extDataHash = await getVAnchorExtDataHash(
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
      let res = await vanchorFixtures.prove_2_2(wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      const vKey = await vanchorFixtures.vkey_2_2();

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
      // Step 1: Alice deposits into Tornado Pool
      const aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
      const relayer = '0x2111111111111111111111111111111111111111';
      const fee = 1e6;
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [await generateUTXOForTest(chainID), await generateUTXOForTest(chainID)],
        [aliceDepositUtxo, await generateUTXOForTest(chainID)],
        BigNumber.from(fee),
        BigNumber.from(0),
        sender.address,
        relayer,
        token.address,
        {}
      );

      // Step 2: Check Alice's balance
      const aliceBalanceAfterDeposit = await token.balanceOf(alice.address);
      assert.strictEqual(
        aliceBalanceAfterDeposit.toString(),
        BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount)).sub(toBN(fee))).toString()
      );

      // Step 3 Check relayers balance
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

      const anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceRefreshUtxo],
        0,
        0,
        '0',
        '0',
        '',
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
      );
    });

    it('should refund native tokens', async () => {
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [],
        [aliceDepositUtxo],
        0,
        0,
        recipient,
        '0',
        token.address,
        {}
      );

      const ethBalanceBefore = await ethers.provider.getBalance(recipient);

      const aliceWithdrawUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: BigNumber.from(chainID).toString(),
        originChainId: BigNumber.from(chainID).toString(),
        amount: BigNumber.from(5e6).toString(),
        blinding: hexToU8a(randomBN().toHexString()),
        keypair: aliceDepositUtxo.keypair,
      });

      const anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      const refundAmount = ethers.utils.parseEther('1');
      await anchor.transact(
        [aliceDepositUtxo],
        [aliceWithdrawUtxo],
        0,
        refundAmount,
        recipient,
        '0',
        '',
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
      );

      const ethBalanceAfter = await ethers.provider.getBalance(recipient);

      assert.strictEqual(ethBalanceAfter.sub(ethBalanceBefore).toString(), refundAmount.toString());
    });

    it('should not refund upon deposit', async () => {
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      const ethBalanceBefore = await ethers.provider.getBalance(recipient);
      const nonZeroRefund = ethers.utils.parseEther('1');
      await assert.rejects(
        anchor.registerAndTransact(
          sender.address,
          aliceDepositUtxo.keypair.toString(),
          [],
          [aliceDepositUtxo],
          0,
          nonZeroRefund,
          recipient,
          '0',
          token.address,
          {}
        ),
        Error,
        'Refund should be zero'
      );

      const ethBalanceAfter = await ethers.provider.getBalance(recipient);

      assert.strictEqual(
        ethBalanceAfter.sub(ethBalanceBefore).toString(),
        ethers.utils.parseEther('0').toString()
      );
    });

    it('should not refund upon internal transfer', async () => {
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [],
        [aliceDepositUtxo],
        0,
        0,
        recipient,
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

      const anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      const nonZeroRefund = ethers.utils.parseEther('1');
      await assert.rejects(
        anchor.transact(
          [aliceDepositUtxo],
          [aliceRefreshUtxo],
          0,
          nonZeroRefund,
          recipient,
          '0',
          '',
          {
            [chainID.toString()]: anchorLeaves,
          },
          {
            treeChainId: chainID.toString(),
          }
        ),
        Error,
        'Refund should be zero'
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

      const anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

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
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
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

      await anchor.transact(
        [],
        [aliceDepositUtxo2],
        0,
        0,
        '0',
        '0',
        token.address,
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
      );

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
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
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
      console.log('here');
      let anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      const aliceDepositAmount3 = 1e7;
      let aliceDepositUtxo3 = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: BigNumber.from(aliceDepositAmount3).toString(),
        keypair: aliceDepositUtxo1.keypair,
      });

      await anchor.transact(
        [],
        [aliceDepositUtxo3],
        0,
        0,
        '0',
        '0',
        token.address,
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
      );
      console.log('here');
      anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

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
      console.log('here');
      await anchor.transact(
        [aliceDepositUtxo1, aliceDepositUtxo2, aliceDepositUtxo3],
        [aliceJoinUtxo],
        0,
        0,
        '0',
        '0',
        '',
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
      );
      console.log('here');
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

      let anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      const vAnchorWrappedTokenBalanceBeforerWithdraw = await wrappedToken.balanceOf(
        anchor.contract.address
      );

      const aliceWithdrawAmount = 5e6;
      const aliceChangeAmount = aliceDepositAmount - aliceWithdrawAmount;
      const aliceChangeUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceChangeAmount.toString(),
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
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
      );

      // Check that Alice receives withdrawn wrapped tokens
      assert.strictEqual(
        aliceWithdrawAmount.toString(),
        await (await wrappedToken.balanceOf(aliceETHAddress)).toString()
      );

      // Check that VAnchor's balance of wrapped tokens goes down by withdraw amount
      const vAnchorWrappedTokenBalanceAfterWithdraw = await wrappedToken.balanceOf(
        anchor.contract.address
      );

      assert.strictEqual(
        vAnchorWrappedTokenBalanceAfterWithdraw.toString(),
        vAnchorWrappedTokenBalanceBeforerWithdraw.sub(aliceWithdrawAmount).toString()
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

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceTransferUtxo],
        0,
        0,
        '0',
        '0',
        '',
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
      );

      anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      await TruffleAssert.reverts(
        anchor.transact(
          [aliceDepositUtxo],
          [aliceTransferUtxo],
          0,
          0,
          '0',
          '0',
          '',
          {
            [chainID.toString()]: anchorLeaves,
          },
          {
            treeChainId: chainID.toString(),
          }
        ),
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
      // Step 1: Alice deposits into Tornado Pool
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

      let anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      // Step 2: Check Alice's balance
      const aliceBalanceAfterDeposit = await token.balanceOf(alice.address);
      assert.strictEqual(
        aliceBalanceAfterDeposit.toString(),
        BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount))).toString()
      );

      // Step 3: Alice tries to create a UTXO with more funds than she has in her account
      const aliceOutputAmount = '100000000000000000000000';
      const aliceOutputUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceOutputAmount,
        keypair: aliceDepositUtxo.keypair,
      });
      // Step 4: Check that step 3 fails
      await TruffleAssert.reverts(
        anchor.transact(
          [aliceDepositUtxo],
          [aliceOutputUtxo],
          0,
          0,
          '0',
          '0',
          token.address,
          {
            [chainID.toString()]: anchorLeaves,
          },
          {
            treeChainId: chainID.toString(),
          }
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

      const extDataHash = await getVAnchorExtDataHash(
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
      let res = await vanchorFixtures.prove_2_2(wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      const proofEncoded = await generateWithdrawProofCallData(proof, publicSignals);

      //correct public inputs
      let publicInputArgs: [string, string, string[], [any, any], string, string] = [
        `0x${proofEncoded}`,
        VAnchor.createRootsBytes(input.roots.map((x) => x.toString())),
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
        VAnchor.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(x)),
        [toFixedHex(input.outputCommitment[0]), toFixedHex(input.outputCommitment[1])],
        toFixedHex(BigNumber.from(input.publicAmount).add(1)),
        toFixedHex(input.extDataHash),
      ];

      let incorrectPublicInputs = VAnchor.convertToPublicInputsStruct(incorrectPublicInputArgs);
      let extAmountInputs = VAnchor.convertToExtDataStruct(extDataArgs);

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
        VAnchor.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(x)),
        [toFixedHex(input.outputCommitment[0]), toFixedHex(input.outputCommitment[1])],
        toFixedHex(input.publicAmount),
        toFixedHex(BigNumber.from(input.extDataHash).add(1)),
      ];

      incorrectPublicInputs = VAnchor.convertToPublicInputsStruct(incorrectPublicInputArgs);

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
        VAnchor.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(x)),
        [
          toFixedHex(BigNumber.from(input.outputCommitment[0]).add(1)),
          toFixedHex(input.outputCommitment[1]),
        ],
        toFixedHex(input.publicAmount),
        toFixedHex(input.extDataHash),
      ];

      incorrectPublicInputs = VAnchor.convertToPublicInputsStruct(incorrectPublicInputArgs);
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
        VAnchor.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(BigNumber.from(x).add(1))),
        [toFixedHex(input.outputCommitment[0]), toFixedHex(input.outputCommitment[1])],
        toFixedHex(input.publicAmount),
        toFixedHex(input.extDataHash),
      ];

      incorrectPublicInputs = VAnchor.convertToPublicInputsStruct(incorrectPublicInputArgs);

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

      let correctPublicInputs = VAnchor.convertToPublicInputsStruct(publicInputArgs);
      let incorrectExtAmountInputs = VAnchor.convertToExtDataStruct(incorrectExtDataArgs);

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

      incorrectExtAmountInputs = VAnchor.convertToExtDataStruct(incorrectExtDataArgs);

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

      incorrectExtAmountInputs = VAnchor.convertToExtDataStruct(incorrectExtDataArgs);

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
    it('should be able to transfer without direct communication between sender and recipient', async () => {
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

      // fetch the inserted leaves
      const leaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      // Bob uses the parsed utxos to issue a withdraw
      receipt = (await anchor.transact(
        spendableUtxos,
        [],
        0,
        0,
        recipient.address,
        '0',
        token.address,
        {
          [chainID.toString()]: leaves,
        },
        {
          treeChainId: chainID.toString(),
        }
      )) as ContractReceipt;

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

      const anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      // withdrawal
      await anchor.transact(
        [aliceDepositUtxo],
        [],
        0,
        0,
        sender.address,
        '0',
        '',
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
      );

      //build merkle tree start
      const filter = anchor.contract.filters.NewCommitment();
      const events = await anchor.contract.queryFilter(filter, 0);

      const leaves = events
        .sort((a: any, b: any) => a.args.index - b.args.index)
        .map((e) => toFixedHex(e.args.commitment));
      const tree = new MerkleTree(levels, leaves);

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
      // expect commitmentV present onchain (it will be in NewCommitment events)

      // in report we can see the tx with NewCommitment event (this is how alice got money)
      // and the tx with NewNullifier event is where alice spent the UTXO
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

      // Attempt to withdraw by creating a proof against a root that shouldn't exist.
      // create the merkle tree
      const fakeTree = new MerkleTree(30);
      const fakeCommitment = u8aToHex(fakeUtxo.commitment);
      fakeTree.insert(fakeCommitment);

      const fakeRoot = fakeTree.root();

      const roots = await anchor.populateRootsForProof();
      roots[1] = fakeRoot;

      const setupVAnchor = new SetupTxVAnchorMock(
        anchor.contract,
        anchor.signer,
        30,
        1,
        anchor.smallCircuitZkComponents,
        anchor.largeCircuitZkComponents,
        roots
      );
      setupVAnchor.token = anchor.token;
      let inputs: Utxo[] = [
        fakeUtxo,
        await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainID.toString(),
          originChainId: chainID.toString(),
          amount: '0',
          blinding: hexToU8a(randomBN(31).toHexString()),
          keypair,
        }),
      ];

      let outputs: [Utxo, Utxo] = [
        await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainID.toString(),
          originChainId: chainID.toString(),
          amount: '0',
          keypair,
        }),
        await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainID.toString(),
          originChainId: chainID.toString(),
          amount: '0',
          keypair,
        }),
      ];

      const { publicInputs, extData } = await setupVAnchor.setupTransaction(
        inputs,
        outputs,
        0,
        0,
        recipient,
        '0',
        setupVAnchor.token,
        {
          [fakeChainId.toString()]: [fakeUtxo.commitment],
          [chainID.toString()]: [hexToU8a(fakeTree.zeroElement.toHexString())],
        }
      );
      await TruffleAssert.reverts(
        anchor.contract.transact(publicInputs.proof, ZERO_BYTES32, extData, publicInputs, {
          encryptedOutput1: outputs[0].encrypt(),
          encryptedOutput2: outputs[1].encrypt(),
        }),
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
      const wrappedAnchor = await VAnchor.createVAnchor(
        verifier.contract.address,
        30,
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

    it('verify storage value of latest leaf index', async () => {
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
      const wrappedAnchor = await VAnchor.createVAnchor(
        verifier.contract.address,
        30,
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
      const wrappedVAnchor = await VAnchor.createVAnchor(
        verifier.contract.address,
        30,
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
      //Check that vAnchor has the right amount of wrapped token balance
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

      let anchorLeaves = wrappedVAnchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDepositIndex = wrappedVAnchor.tree.getIndexByElement(aliceDepositUtxo.commitment);
      aliceDepositUtxo.setIndex(aliceDepositIndex);

      //Check that vAnchor has the right amount of wrapped token balance
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
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
      );

      const balTokenAfterWithdrawAndUnwrapSender = await token.balanceOf(sender.address);
      assert.strictEqual(
        balTokenBeforeDepositSender.toString(),
        balTokenAfterWithdrawAndUnwrapSender.toString()
      );
    });

    it('wrapping fee should work correctly with transact and wrap', async () => {
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
      const wrappedVAnchor = await VAnchor.createVAnchor(
        verifier.contract.address,
        30,
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

      const balWrappedTokenBeforeDepositAnchor = await wrappedToken.balanceOf(
        wrappedVAnchor.contract.address
      );
      const balUnwrappedTokenBeforeDepositSender = await token.balanceOf(sender.address);
      const balUnwrappedTokenBeforeDepositWrapper = await token.balanceOf(wrappedToken.address);

      await wrappedVAnchor.transact([], [aliceDepositUtxo], 0, 0, '0', '0', token.address, {});

      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDepositIndex = wrappedVAnchor.tree.getIndexByElement(aliceDepositUtxo.commitment);
      aliceDepositUtxo.setIndex(aliceDepositIndex);

      // Balance of VAnchor wrapped token should be 2e7
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
        {
          [chainID.toString()]: anchorLeaves,
        },
        {
          treeChainId: chainID.toString(),
        }
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
          {
            [chainID.toString()]: anchorLeaves,
          },
          {
            treeChainId: chainID.toString(),
          }
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
  });

  describe('#getDepositLeaves', () => {
    const deposit = async () => {
      // Alice deposits into the pool
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
    };

    it('First deposit should return 2 leaves', async () => {
      // We fallback to final block to get the latest block
      const finalBlock = 0;
      const lastQueriedBlock = 0;

      await deposit();

      // Get the leaves
      const depositLeaves = await anchor.getDepositLeaves(
        lastQueriedBlock,
        finalBlock,
        retryPromiseMock
      );

      assert.strictEqual(depositLeaves.newLeaves.length, 2);

      // Validate the leaves
      const treeHeight = await anchor.contract.getLevels();
      const lastRoot = await anchor.contract.getLastRoot();
      const provingTree = MerkleTree.createTreeWithRoot(
        treeHeight,
        depositLeaves.newLeaves,
        toFixedHex(lastRoot.toHexString())
      );

      assert.notEqual(provingTree, undefined);
    });

    it('Odd number of deposits after the first deposit, then validate the leaves', async () => {
      // We fallback to final block to get the latest block
      const finalBlock = 0;

      let lastQueriedBlock = 0;
      const leaves = [];

      await deposit();

      // First do a deposit
      const firstDepositLeaves = await anchor.getDepositLeaves(
        lastQueriedBlock + 1,
        finalBlock,
        retryPromiseMock
      );

      // Cache the leaves
      lastQueriedBlock = firstDepositLeaves.lastQueriedBlock;
      leaves.push(...firstDepositLeaves.newLeaves);

      // Do another deposit
      await deposit();

      // Get the leaves
      const latestDepositLeaves = await anchor.getDepositLeaves(
        lastQueriedBlock + 1,
        finalBlock,
        retryPromiseMock
      );

      // Merge the leaves
      leaves.push(...latestDepositLeaves.newLeaves);

      // Validate the leaves
      const treeHeight = await anchor.contract.getLevels();
      const lastRoot = await anchor.contract.getLastRoot();
      const provingTree = MerkleTree.createTreeWithRoot(
        treeHeight,
        leaves,
        toFixedHex(lastRoot.toHexString())
      );

      assert.notEqual(provingTree, undefined);
    });

    it('Even number of deposits after the first deposit, then validate the leaves', async () => {
      // We fallback to final block to get the latest block
      const finalBlock = 0;

      let lastQueriedBlock = 0;
      const leaves = [];

      await deposit();

      // First do a deposit
      const firstDepositLeaves = await anchor.getDepositLeaves(
        lastQueriedBlock + 1,
        finalBlock,
        retryPromiseMock
      );

      // Cache the leaves
      lastQueriedBlock = firstDepositLeaves.lastQueriedBlock;
      leaves.push(...firstDepositLeaves.newLeaves);

      // Do 2 deposits
      await Promise.all([deposit(), deposit()]);

      // Latest leaves
      const latestLeaves = await anchor.getDepositLeaves(
        lastQueriedBlock + 1,
        finalBlock,
        retryPromiseMock
      );

      // Merge the leaves
      leaves.push(...latestLeaves.newLeaves);

      // Validate the leaves
      const treeHeight = await anchor.contract.getLevels();
      const lastRoot = await anchor.contract.getLastRoot();
      const provingTree = MerkleTree.createTreeWithRoot(
        treeHeight,
        leaves,
        toFixedHex(lastRoot.toHexString())
      );

      assert.notEqual(provingTree, undefined);
    });
  });

  describe('#isWebbTokenApprovalRequired', () => {
    it('should return true if the webb token is not approved', async () => {
      const amount = 1000;
      const amountInWei = ethers.utils.parseEther(amount.toString());
      const isApprovalRequired = await anchor.isWebbTokenApprovalRequired(amountInWei);
      assert.strictEqual(isApprovalRequired, true);
    });

    it('should return false if the webb token is approved', async () => {
      const amount = 1000;
      const amountInWei = ethers.utils.parseEther(amount.toString());
      const spender = anchor.contract.address;

      const webbToken = await anchor.getWebbToken();

      // Approve the anchor contract
      const tx = await webbToken.approve(spender, amountInWei);
      await tx.wait();

      const isApprovalRequired = await anchor.isWebbTokenApprovalRequired(amountInWei);
      assert.strictEqual(isApprovalRequired, false);
    });
  });

  describe('#isWrappableTokenApprovalRequired', () => {
    it('should return true if the wrappable token is not approved', async () => {
      const amount = 1000;
      const amountInWei = ethers.utils.parseEther(amount.toString());

      const amountToWrap = await wrappedToken.getAmountToWrap(amountInWei);

      const isApprovalRequired = await anchor.isWrappableTokenApprovalRequired(
        token.address,
        amountToWrap
      );

      assert.strictEqual(isApprovalRequired, true);
    });

    it('should return false if the wrappable token is approved', async () => {
      const amount = 1000;
      const amountInWei = ethers.utils.parseEther(amount.toString());
      const amountToWrap = await wrappedToken.getAmountToWrap(amountInWei);

      const spender = anchor.contract.address;

      // Approve the anchor contract
      await token.approve(spender, amountToWrap);

      const isApprovalRequired = await anchor.isWrappableTokenApprovalRequired(
        token.address,
        amountToWrap
      );

      assert.strictEqual(isApprovalRequired, false);
    });
  });
});
