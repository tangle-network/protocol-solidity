/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

const { expect } = require('chai');
import { MerkleTree, toFixedHex, randomBN } from '@webb-tools/sdk-core';
import { BigNumber } from 'ethers';
import { contract, ethers } from 'hardhat';
import { PoseidonHasher } from '@webb-tools/anchors';
import { BatchTreeUpdaterMock as BatchTreeUpdater } from './mocks/BatchTreeUpdaterMock';
import { ZkComponents, batchTreeFixtures } from '@webb-tools/utils';
import {
  VerifierBatch_4__factory,
  VerifierBatch_8__factory,
  VerifierBatch_16__factory,
  VerifierBatch_32__factory,
  BatchTreeVerifierSelector__factory,
} from '@webb-tools/masp-anchor-contracts';

contract('BatchMerkleTree w/ Poseidon hasher', (accounts) => {
  let merkleTree;
  let batchTree: BatchTreeUpdater;
  let hasherInstance: PoseidonHasher;
  let zkComponents_4: ZkComponents;
  let zkComponents_8: ZkComponents;
  let zkComponents_16: ZkComponents;
  let zkComponents_32: ZkComponents;
  // dummy
  const instance = '0x1111000000000000000000000000000000001111';

  const levels = 20;
  let initialRoot: BigNumber;

  beforeEach(async () => {
    zkComponents_4 = await batchTreeFixtures[4]();
    zkComponents_8 = await batchTreeFixtures[8]();
    zkComponents_16 = await batchTreeFixtures[16]();
    zkComponents_32 = await batchTreeFixtures[32]();

    const signers = await ethers.getSigners();
    const wallet = signers[0];
    hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);
    merkleTree = new MerkleTree(levels);
    const verifierFactory_4 = new VerifierBatch_4__factory(wallet);
    const verifier_4 = await verifierFactory_4.deploy();

    const verifierFactory_8 = new VerifierBatch_8__factory(wallet);
    const verifier_8 = await verifierFactory_8.deploy();

    const verifierFactory_16 = new VerifierBatch_16__factory(wallet);
    const verifier_16 = await verifierFactory_16.deploy();

    const verifierFactory_32 = new VerifierBatch_32__factory(wallet);
    const verifier_32 = await verifierFactory_32.deploy();

    const verifierSelectorFactory = new BatchTreeVerifierSelector__factory(wallet);
    const verifierSelector = await verifierSelectorFactory.deploy(
      verifier_4.address,
      verifier_8.address,
      verifier_16.address,
      verifier_32.address
    );

    // const factory = await ethers.getContractFactory('BatchMerkleTree', {
    //   signer: wallet,
    // });
    // contract = await factory.deploy(levels, hasherInstance.contract.address, verifierSelector.address);
    batchTree = await BatchTreeUpdater.createBatchTreeUpdaterMock(
      verifierSelector.address,
      levels,
      hasherInstance.contract.address,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32,
      wallet
    );
    initialRoot = await batchTree.contract.getLastRoot();
  });
  describe('#registration', () => {
    it('should register a deposit', async () => {
      // const commitment = randomBN()
      const commitment = toFixedHex(randomBN().toHexString());
      let tx = await batchTree.registerInsertion(instance, toFixedHex(commitment));
      // let receipt = await tx.wait()
      expect(tx).to.emit(batchTree.contract, 'DepositData').withArgs(instance, commitment, 0, 0);
    });
    it('should register up to 16 deposits', async () => {
      // const commitment = randomBN()
      let queueLength = (await batchTree.contract.queueLength()).toNumber();
      while (queueLength < 16) {
        const commitment = toFixedHex(randomBN().toHexString());
        let tx = await batchTree.registerInsertion(instance, toFixedHex(commitment));
        // let receipt = await tx.wait()
        expect(tx)
          .to.emit(batchTree.contract, 'DepositData')
          .withArgs(instance, commitment, 0, queueLength);
        queueLength += 1;
      }
    });
  });
  describe.skip('#batchInsert_4', () => {
    const batchHeight = 2;
    const batchSize = 2 ** batchHeight;
    let leaves = [];
    beforeEach(async () => {
      const oldRoot = merkleTree.root().toString();
      // Dummy value
      for (let i = 0; i < batchSize; i++) {
        const commitment = toFixedHex(randomBN().toHexString());
        leaves.push(commitment);
        await batchTree.registerInsertion(instance, toFixedHex(commitment));
      }
    });
    it('should prove snark for 4 leaves', async () => {
      const { verified } = await batchTree.generateProof(batchSize, leaves);
      expect(verified).to.equal(true);
    });
    it('should batch insert 4 leaves', async () => {
      let { input, tx } = await batchTree.batchInsert(batchSize);
      const updatedRoot = await batchTree.contract.getLastRoot();
      expect(updatedRoot).to.equal(input['newRoot']);
    });
  });
  describe.skip('#batchInsert_8', () => {
    const batchHeight = 3;
    const batchSize = 2 ** batchHeight;
    let leaves = [];
    beforeEach(async () => {
      // Dummy value
      for (let i = 0; i < batchSize; i++) {
        const commitment = toFixedHex(randomBN().toHexString());
        leaves.push(commitment);
        await batchTree.registerInsertion(instance, toFixedHex(commitment));
      }
    });
    it('should prove snark for 8 leaves', async () => {
      const { verified } = await batchTree.generateProof(batchSize, leaves);
      expect(verified).to.equal(true);
    });
    it('should batch insert 8 leaves', async () => {
      let { input, tx } = await batchTree.batchInsert(batchSize);
      let receipt = await tx.wait();
      const updatedRoot = await batchTree.contract.getLastRoot();
      expect(updatedRoot).to.equal(input['newRoot']);
    });
  });
  describe.skip('#batchInsert_16', () => {
    const batchHeight = 4;
    const batchSize = 2 ** batchHeight;
    let leaves = [];
    beforeEach(async () => {
      for (let i = 0; i < batchSize; i++) {
        const commitment = toFixedHex(randomBN().toHexString());
        leaves.push(commitment);
        await batchTree.registerInsertion(instance, toFixedHex(commitment));
      }
    });
    it('should prove snark for 16 leaves', async () => {
      const { verified } = await batchTree.generateProof(batchSize, leaves);
      expect(verified).to.equal(true);
    });
    it('should batch insert 16 leaves', async () => {
      let { input, tx } = await batchTree.batchInsert(batchSize);
      let receipt = await tx.wait();
      const updatedRoot = await batchTree.contract.getLastRoot();
      expect(updatedRoot).to.equal(input['newRoot']);
    });
  });
  describe.skip('#batchInsert_32', () => {
    const batchHeight = 5;
    const batchSize = 2 ** batchHeight;
    let leaves = [];
    beforeEach(async () => {
      for (let i = 0; i < batchSize; i++) {
        const commitment = toFixedHex(randomBN().toHexString());
        leaves.push(commitment);
        await batchTree.registerInsertion(instance, toFixedHex(commitment));
      }
    });
    it('should prove snark for 32 leaves', async () => {
      const { verified } = await batchTree.generateProof(batchSize, leaves);
      expect(verified).to.equal(true);
    });
    it('should batch insert 32 leaves', async () => {
      let { input, tx } = await batchTree.batchInsert(batchSize);
      let receipt = await tx.wait();
      const updatedRoot = await batchTree.contract.getLastRoot();
      expect(updatedRoot).to.equal(input['newRoot']);
    });
  });

  describe('#batchInsert mix', () => {
    it('should batch insert 4 leaves after a 16 batchInsertion', async () => {
      const batchHeight_16 = 4;
      const batchSize_16 = 2 ** batchHeight_16;
      const batchHeight_4 = 2;
      const batchSize_4 = 2 ** batchHeight_4;

      for (let i = 0; i < batchSize_4 + batchSize_16; i++) {
        const commitment = toFixedHex(randomBN().toHexString());
        await batchTree.registerInsertion(instance, toFixedHex(commitment));
      }
      let { input: input_16 } = await batchTree.batchInsert(batchSize_16);
      const updatedRoot_16 = await batchTree.contract.getLastRoot();
      expect(updatedRoot_16).to.equal(input_16['newRoot']);

      let { input: input_4 } = await batchTree.batchInsert(batchSize_4);
      const updatedRoot_4 = await batchTree.contract.getLastRoot();
      expect(updatedRoot_4).to.equal(input_4['newRoot']);
    });
    // this takes way too long
    it.skip('should do [16, 8, 8, 16] batchInsertions respectively', async () => {
      const batchHeight_16 = 4;
      const batchSize_16 = 2 ** batchHeight_16;
      const batchHeight_8 = 3;
      const batchSize_8 = 2 ** batchHeight_8;

      // 16 + 8 + 8 + 16 == 3*batchSize_16
      for (let i = 0; i < 3 * batchSize_16; i++) {
        const commitment = toFixedHex(randomBN().toHexString());
        await batchTree.registerInsertion(instance, toFixedHex(commitment));
      }
      let { input: input_first } = await batchTree.batchInsert(batchSize_16);
      const updatedRoot_first = await batchTree.contract.getLastRoot();
      expect(updatedRoot_first).to.equal(input_first['newRoot']);

      let { input: input_second } = await batchTree.batchInsert(batchSize_8);
      const updatedRoot_second = await batchTree.contract.getLastRoot();
      expect(updatedRoot_second).to.equal(input_second['newRoot']);

      let { input: input_third } = await batchTree.batchInsert(batchSize_8);
      const updatedRoot_third = await batchTree.contract.getLastRoot();
      expect(updatedRoot_third).to.equal(input_third['newRoot']);

      let { input: input_last } = await batchTree.batchInsert(batchSize_16);
      const updatedRoot_last = await batchTree.contract.getLastRoot();
      expect(updatedRoot_last).to.equal(input_last['newRoot']);
    });
  });
});
