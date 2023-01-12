/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

import { toFixedHex } from '@webb-tools/sdk-core';
import { BigNumber } from 'ethers';
import { toBN } from 'web3-utils';
import { Keypair, CircomUtxo, toBuffer, randomBN } from '@webb-tools/sdk-core';
import { artifacts, contract, ethers } from 'hardhat';
import { poseidon, pedersenHash, buildPedersenHash } from 'circomlibjs';
import { PoseidonHasher } from '@webb-tools/anchors';
import { expect } from 'chai';
import {
  MerkleTree,
  MerkleTree__factory,
  RewardTreesMock,
  RewardTreesMock__factory,
  MerkleTreePoseidonMock,
  MerkleTreePoseidonMock__factory,
} from '../../typechain';

// Pedersen class
class Pedersen {
  pedersenHash: any;
  babyJub: any;
  constructor() {
    this.pedersenHash = null;
    this.babyJub = null;
    this.initPedersen();
  }

  async initPedersen() {
    this.pedersenHash = await buildPedersenHash();
    this.babyJub = this.pedersenHash.babyJub;
  }

  unpackPoint(buffer) {
    return this.babyJub.unpackPoint(this.pedersenHash.hash(buffer));
  }

  toStringBuffer(buffer) {
    return this.babyJub.F.toString(buffer);
  }
}

// Note class
class Note {
  secret: any;
  nullifier: any;
  commitment: any;
  nullifierHash: any;
  rewardNullifier: any;
  netId: any;
  amount: any;
  currency: any;
  depositBlock: any;
  withdrawalBlock: any;
  instance: any;
  pedersen: any;

  constructor({
    secret,
    nullifier,
    netId,
    amount,
    currency,
    depositBlock,
    withdrawalBlock,
    instance,
  }: any = {}) {
    this.pedersen = new Pedersen();

    this.secret = secret ? toBN(secret) : randomBN(31);
    this.nullifier = nullifier ? toBN(nullifier) : randomBN(31);

    const nullifierBuffer = toBuffer(this.nullifier, 31);
    const secretBuffer = toBuffer(this.secret, 31);
    const combinedBuffer = Buffer.concat([nullifierBuffer, secretBuffer]);
    const hashedCombinedBuffer = pedersenHash.hash(combinedBuffer);

    this.nullifierHash = randomBN(31);
    this.commitment = randomBN(31);
    this.rewardNullifier = poseidon([this.nullifier]);

    this.netId = netId;
    this.amount = amount;
    this.currency = currency;
    this.depositBlock = BigNumber.from(depositBlock);
    this.withdrawalBlock = BigNumber.from(withdrawalBlock);
    this.instance = instance || Note.getInstance();
  }

  static getInstance(/* currency, amount */) {
    // todo
  }

  static fromString(note: any, instance: any, depositBlock: any, withdrawalBlock: any) {
    note = note.split('-');
    const [, currency, amount, netId] = note;
    const hexNote = note[4].slice(2);
    const nullifier = toBN(hexNote.slice(0, 62));
    const secret = toBN(hexNote.slice(62));
    return new Note({
      secret,
      nullifier,
      netId,
      amount,
      currency,
      depositBlock,
      withdrawalBlock,
      instance,
    });
  }
}

async function registerDeposit(note, rewardTrees) {
  await rewardTrees.setBlockNumber(note.depositBlock);
  await rewardTrees.registerDeposit(note.instance, toFixedHex(note.commitment));
  return {
    instance: note.instance,
    hash: toFixedHex(note.commitment),
    block: toFixedHex(note.depositBlock),
  };
}

async function registerWithdrawal(note, rewardTrees) {
  await rewardTrees.setBlockNumber(note.withdrawalBlock);
  await rewardTrees.registerWithdrawal(note.instance, toFixedHex(note.nullifierHash));
  return {
    instance: note.instance,
    hash: toFixedHex(note.nullifierHash),
    block: toFixedHex(note.withdrawalBlock),
  };
}

const poseidonHash = (items) => toBN(poseidon(items).toString());

const poseidonHash2 = (a, b) => poseidonHash([a, b]);

contract('RewardTree tests', (accounts) => {
  let rewardTrees: any; // RewardTreesMock;
  let snapshotId;
  let hasher2;
  let hasher3;
  let wallet;
  let operator = accounts[0];
  let depositTree: any; // typeof MerkleTree;
  let withdrawalTree: any; // typeof MerkleTree;
  const instances = {
    one: '0x0000000000000000000000000000000000000001',
    two: '0x0000000000000000000000000000000000000002',
    three: '0x0000000000000000000000000000000000000003',
    four: '0x0000000000000000000000000000000000000004',
  };

  const note1 = new Note({
    instance: instances.one,
    depositBlock: 10,
    withdrawalBlock: 10 + 4 * 60 * 24,
  });
  const note2 = new Note({
    instance: instances.two,
    depositBlock: 10,
    withdrawalBlock: 10 + 2 * 4 * 60 * 24,
  });
  const note3 = new Note({
    instance: instances.three,
    depositBlock: 10,
    withdrawalBlock: 10 + 3 * 4 * 60 * 24,
  });

  let merkleTreeWithHistory;
  let hasherInstance: PoseidonHasher;
  let levels = 16;
  const sender = accounts[0];
  let tree: any; // MerkleTree
  let factory: any;
  let merkleTreeFactory: any;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);
    const factory = new RewardTreesMock__factory(wallet);
    const merkleTreeFactory = new MerkleTree__factory(wallet);

    rewardTrees = await factory.deploy(
      operator,
      hasherInstance.contract.address,
      hasherInstance.contract.address,
      levels
    );
    await rewardTrees.deployed();

    let depositTreeAddress = await rewardTrees.depositTree();
    let depositTree = await ethers.getContractAt('MerkleTree', depositTreeAddress);
    let withdrawalTreeAddress = await rewardTrees.withdrawalTree();
    let withdrawalTree = await ethers.getContractAt('MerkleTree', withdrawalTreeAddress);
  });

  // Basic test for RewardTrees constructor
  describe('constructor', () => {
    it('should initialize', async () => {
      console.log('initialized');
    });
  });

  describe('#updateRoots', () => {
    it('should work for many instances', async () => {
      const note1DepositLeaf = await registerDeposit(note1, rewardTrees);
      const note2DepositLeaf = await registerDeposit(note2, rewardTrees);

      const note2WithdrawalLeaf = await registerWithdrawal(note2, rewardTrees);

      const note3DepositLeaf = await registerDeposit(note3, rewardTrees);
      const note3WithdrawalLeaf = await registerWithdrawal(note3, rewardTrees);

      await rewardTrees.updateRoots(
        [note1DepositLeaf, note2DepositLeaf, note3DepositLeaf],
        [note2WithdrawalLeaf, note3WithdrawalLeaf]
      );

      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const merkleTreeFactory = new MerkleTreePoseidonMock__factory(wallet);
      const localDepositTree = await merkleTreeFactory.deploy(
        levels,
        hasherInstance.contract.address
      );
      await localDepositTree.deployed();

      await localDepositTree.insert(
        await hasherInstance.contract.hash3([note1.instance, note1.commitment, note1.depositBlock])
      );
      await localDepositTree.insert(
        await hasherInstance.contract.hash3([note2.instance, note2.commitment, note2.depositBlock])
      );
      await localDepositTree.insert(
        await hasherInstance.contract.hash3([note3.instance, note3.commitment, note3.depositBlock])
      );

      const lastDepositRoot = await rewardTrees.depositRoot();
      const localDepositRoot = await localDepositTree.getLastRoot();
      expect(lastDepositRoot.toString()).to.be.equal(localDepositRoot.toString());

      const localWithdrawalTree = await merkleTreeFactory.deploy(
        levels,
        hasherInstance.contract.address
      );
      await localWithdrawalTree.deployed();

      localWithdrawalTree.insert(
        await hasherInstance.contract.hash3([
          note2.instance,
          note2.nullifierHash,
          note2.withdrawalBlock,
        ])
      );
      localWithdrawalTree.insert(
        await hasherInstance.contract.hash3([
          note3.instance,
          note3.nullifierHash,
          note3.withdrawalBlock,
        ])
      );

      const lastWithdrawalRoot = await rewardTrees.withdrawalRoot();
      const localWithdrawalRoot = await localWithdrawalTree.getLastRoot();
      expect(lastWithdrawalRoot.toString()).to.be.equal(localWithdrawalRoot.toString());
    });
    it('should work for empty arrays', async () => {
      await rewardTrees.updateRoots([], []);
    });
  });

  describe('#getRegisteredDeposits', () => {
    it('should work', async () => {
      const note1DepositLeaf = await registerDeposit(note1, rewardTrees);
      let res = await rewardTrees.getRegisteredDeposits();
      expect(res.length).to.be.equal(1);
      await rewardTrees.updateRoots([note1DepositLeaf], []);

      res = await rewardTrees.getRegisteredDeposits();
      expect(res.length).to.be.equal(0);

      await registerDeposit(note2, rewardTrees);
      res = await rewardTrees.getRegisteredDeposits();
    });
  });
});
