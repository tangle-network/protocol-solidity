/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

import { MerkleTree, toFixedHex } from '@webb-tools/sdk-core';
import { BigNumber } from 'ethers';
import { toBN, BN } from 'web3-utils';
import { Keypair, CircomUtxo, toBuffer, randomBN } from '@webb-tools/sdk-core';
import { artifacts, contract, ethers } from 'hardhat';
import {
  poseidon,
  pedersenHash,
  pedersenHashBuffer,
  babyJub,
  buildBabyJub,
  buildPedersenHash,
} from 'circomlibjs';

import { PoseidonHasher } from '@webb-tools/anchors';

const TruffleAssert = require('truffle-assertions');
const assert = require('assert');

const MerkleTreeWithHistory = artifacts.require('MerkleTreePoseidonMock');
const RewardTrees = artifacts.require('RewardTreesMock');

const pedersenHashBuffer = async (buffer) => {
  const babyJub = await buildBabyJub();
  const res = toBN(babyJub.unpackPoint(pedersenHash.hash(buffer))[0].toString());
  return res;
};

// Note class
class Note {
  secret: BN;
  nullifier: BN;
  commitment: Buffer;
  nullifierHash: Buffer;
  rewardNullifier: any;
  netId: any;
  amount: any;
  currency: any;
  depositBlock: BN;
  withdrawalBlock: BN;
  instance: any;

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
    this.secret = secret ? toBN(secret) : randomBN(31);
    this.nullifier = nullifier ? toBN(nullifier) : randomBN(31);

    this.commitment = null;
    this.nullifierHash = null;
    // this.commitment = pedersenHashBuffer(
    //   Buffer.concat([toBuffer(this.nullifier, 31), toBuffer(this.secret, 31)])
    //   //Buffer.concat([this.nullifier.toBuffer('le', 31), this.secret.toBuffer('le', 31)])
    // );
    //this.nullifierHash = pedersenHashBuffer(toBuffer(this.nullifier, 31));
    //this.nullifierHash = pedersenHashBuffer(this.nullifier.toBuffer('le', 31));
    this.rewardNullifier = poseidon([this.nullifier]);

    this.netId = netId;
    this.amount = amount;
    this.currency = currency;
    this.depositBlock = toBN(depositBlock);
    this.withdrawalBlock = toBN(withdrawalBlock);
    this.instance = instance || Note.getInstance();
  }

  static getInstance(/* currency, amount */) {
    // todo
  }

  static fromString(note: any, instance: any, depositBlock: any, withdrawalBlock: any) {
    note = note.split('-');
    const [, currency, amount, netId] = note;
    const hexNote = note[4].slice(2);
    const nullifier = new BN(hexNote.slice(0, 62), 16, 'le');
    const secret = new BN(hexNote.slice(62), 16, 'le');
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

contract('RewardTree tests', (accounts) => {
  let rewardTrees;
  let snapshotId;
  let hasher2;
  let hasher3;
  let operator = accounts[0];
  let depositTree;
  let withdrawalTree;
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
  let levels = 30;
  const sender = accounts[0];
  let tree: MerkleTree;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);
    depositTree = new MerkleTree(levels);
    withdrawalTree = new MerkleTree(levels);
    // TODO: create rewardProxy
    rewardTrees = await RewardTrees.new(
      operator,
      hasherInstance.contract.address,
      hasherInstance.contract.address,
      levels
    );
  });

  // Basic test for RewardTrees constructor
  describe('constructor', () => {
    it('should initialize', async () => {
      console.log('initialized..');
    });
  });
});
