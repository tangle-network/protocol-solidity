/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

const { expect } = require('chai');
// const { toFixedHex, poseidonHash2, randomBN } = require('../src/utils')
// const MerkleTree = require('fixed-merkle-tree')
import { MerkleTree, toFixedHex, toBuffer, randomBN } from '@webb-tools/sdk-core';
import { BigNumber } from 'ethers';
import { artifacts, contract, ethers } from 'hardhat';
import { poseidon } from 'circomlibjs';
import { PoseidonHasher, BatchTreeUpdater } from '@webb-tools/anchors';
import { randomBytes } from 'crypto';
// import { groth16 } from 'snarkjs';
// const TruffleAssert = require('truffle-assertions');
import { hexToU8a, u8aToHex, ZkComponents, fetchComponentsFromFilePaths } from '@webb-tools/utils';
import {
  // BatchMerkleTree as BatchMerkleTreeContract,
  // BatchMerkleTree__factory,
  VerifierBatch4__factory,
  VerifierBatch8__factory,
  VerifierBatch16__factory,
  VerifierBatch32__factory,
  BatchTreeVerifierSelector__factory
} from '../../typechain';
import jsSHA from 'jssha';
import path from 'path';
const snarkjs = require('snarkjs');

// const MerkleTreeWithHistory = artifacts.require('MerkleTreePoseidonMock');

// const instances = [
//   '0x1111000000000000000000000000000000001111',
//   '0x2222000000000000000000000000000000002222',
//   '0x3333000000000000000000000000000000003333',
//   '0x4444000000000000000000000000000000004444',
// ]

const blocks = ['0xaaaaaaaa', '0xbbbbbbbb', '0xcccccccc', '0xdddddddd'];

contract.only('BatchMerkleTree w/ Poseidon hasher', (accounts) => {
  let merkleTree;
  let batchTree: BatchTreeUpdater;
  let hasherInstance: PoseidonHasher;
  let zkComponents_4: ZkComponents;
  let zkComponents_8: ZkComponents;
  let zkComponents_16: ZkComponents;
  let zkComponents_32: ZkComponents;
  // dummy
  const instance = '0x1111000000000000000000000000000000001111',
  // let levels = 30;
  const wasmFilePath_4 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/4/batchMerkleTreeUpdate_4.wasm'
  )
  const zkeyFilePath_4 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/4/circuit_final.zkey'
  )
  const wtnsCalcFilePath_4 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/4/witness_calculator.cjs'
  )

  const wasmFilePath_8 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/8/batchMerkleTreeUpdate_8.wasm'
  )
  const zkeyFilePath_8 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/8/circuit_final.zkey'
  )
  const wtnsCalcFilePath_8 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/8/witness_calculator.cjs'
  )

  const wasmFilePath_16 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/16/batchMerkleTreeUpdate_16.wasm'
  )
  const zkeyFilePath_16 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/16/circuit_final.zkey'
  )
  const wtnsCalcFilePath_16 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/16/witness_calculator.cjs'
  )

  const wasmFilePath_32 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/32/batchMerkleTreeUpdate_32.wasm'
  )
  const zkeyFilePath_32 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/32/circuit_final.zkey'
  )
  const wtnsCalcFilePath_32 = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/32/witness_calculator.cjs'
  )

  const levels = 20;
  const CHUNK_TREE_HEIGHT = 4;
  const sender = accounts[0];
  let tree: MerkleTree;
  let initialRoot: BigNumber;

  beforeEach(async () => {
    zkComponents_4 = await fetchComponentsFromFilePaths(
      wasmFilePath_4,
      wtnsCalcFilePath_4,
      zkeyFilePath_4,
    );
    zkComponents_8 = await fetchComponentsFromFilePaths(
      wasmFilePath_8,
      wtnsCalcFilePath_8,
      zkeyFilePath_8,
    );
    zkComponents_16 = await fetchComponentsFromFilePaths(
      wasmFilePath_16,
      wtnsCalcFilePath_16,
      zkeyFilePath_16,
    );
    zkComponents_32 = await fetchComponentsFromFilePaths(
      wasmFilePath_32,
      wtnsCalcFilePath_32,
      zkeyFilePath_32,
    );
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);
    merkleTree = new MerkleTree(levels);
    const verifierFactory_4 = new VerifierBatch4__factory(wallet);
    const verifier_4 = await verifierFactory_4.deploy();

    const verifierFactory_8 = new VerifierBatch8__factory(wallet);
    const verifier_8 = await verifierFactory_8.deploy();

    const verifierFactory_16 = new VerifierBatch16__factory(wallet);
    const verifier_16 = await verifierFactory_16.deploy();

    const verifierFactory_32 = new VerifierBatch32__factory(wallet);
    const verifier_32 = await verifierFactory_32.deploy();

    const verifierSelectorFactory = new BatchTreeVerifierSelector__factory(wallet)
    const verifierSelector = await verifierSelectorFactory.deploy(verifier_4.address, verifier_8.address, verifier_16.address, verifier_32.address);

    // const factory = await ethers.getContractFactory('BatchMerkleTree', {
    //   signer: wallet,
    // });
    // contract = await factory.deploy(levels, hasherInstance.contract.address, verifierSelector.address);
    batchTree = await BatchTreeUpdater.createBatchTreeUpdater(
      verifierSelector.address,
      levels,
      hasherInstance.contract.address,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32,
      wallet
    )
    initialRoot = await batchTree.contract.getLastRoot()
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
        expect(tx).to.emit(batchTree.contract, 'DepositData').withArgs(instance, commitment, 0, queueLength);
        queueLength += 1;
      }
    });
  });
  describe('#batchInsert_4', () => {
    const batchHeight = 2;
    const batchSize = 2 ** batchHeight;
    let leaves = []
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
      const { verified } = await batchTree.generateProof(batchSize, leaves)
      expect(verified).to.equal(true)
    });
    it('should batch insert 4 leaves', async () => {
        let { input, tx } = await batchTree.batchInsert(batchSize);
        const updatedRoot = await batchTree.contract.getLastRoot();
        expect(updatedRoot).to.equal(input['newRoot'])
    });
  });
  describe('#batchInsert_8', () => {
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
      const { verified } = await batchTree.generateProof(batchSize, leaves)
      expect(verified).to.equal(true)
    });
    it('should batch insert 8 leaves', async () => {
      let { input, tx } = await batchTree.batchInsert(batchSize);
      let receipt = await tx.wait()
      const updatedRoot = await batchTree.contract.getLastRoot();
      expect(updatedRoot).to.equal(input['newRoot'])
    });
  });
  describe('#batchInsert_16', () => {
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
      const { verified } = await batchTree.generateProof(batchSize, leaves)
      expect(verified).to.equal(true)
    });
    it('should batch insert 16 leaves', async () => {
      let { input, tx } = await batchTree.batchInsert(batchSize);
      let receipt = await tx.wait()
      const updatedRoot = await batchTree.contract.getLastRoot();
      expect(updatedRoot).to.equal(input['newRoot'])
    });
  });
  describe('#batchInsert_32', () => {
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
      const { verified } = await batchTree.generateProof(batchSize, leaves)
      expect(verified).to.equal(true)
    });
    it('should batch insert 32 leaves', async () => {
      let { input, tx } = await batchTree.batchInsert(batchSize);
      let receipt = await tx.wait()
      const updatedRoot = await batchTree.contract.getLastRoot();
      expect(updatedRoot).to.equal(input['newRoot'])
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
      expect(updatedRoot_16).to.equal(input_16['newRoot'])

      let { input: input_4 } = await batchTree.batchInsert(batchSize_4);
      const updatedRoot_4 = await batchTree.contract.getLastRoot();
      expect(updatedRoot_4).to.equal(input_4['newRoot'])
    });
    it('should do [16, 8, 8, 16] batchInsertions respectively', async () => {
      const batchHeight_16 = 4;
      const batchSize_16 = 2 ** batchHeight_16;
      const batchHeight_8 = 3;
      const batchSize_8 = 2 ** batchHeight_8;


      // 16 + 8 + 8 + 16 == 3*batchSize_16
      for (let i = 0; i <  3*batchSize_16; i++) {
        const commitment = toFixedHex(randomBN().toHexString());
        await batchTree.registerInsertion(instance, toFixedHex(commitment));
      }
      let { input: input_first } = await batchTree.batchInsert(batchSize_16);
      const updatedRoot_first = await batchTree.contract.getLastRoot();
      expect(updatedRoot_first).to.equal(input_first['newRoot'])

      let { input: input_second } = await batchTree.batchInsert(batchSize_8);
      const updatedRoot_second = await batchTree.contract.getLastRoot();
      expect(updatedRoot_second).to.equal(input_second['newRoot'])

      let { input: input_third } = await batchTree.batchInsert(batchSize_8);
      const updatedRoot_third = await batchTree.contract.getLastRoot();
      expect(updatedRoot_third).to.equal(input_third['newRoot'])

      let { input: input_last } = await batchTree.batchInsert(batchSize_16);
      const updatedRoot_last = await batchTree.contract.getLastRoot();
      expect(updatedRoot_last).to.equal(input_last['newRoot'])
    });
  });
});
