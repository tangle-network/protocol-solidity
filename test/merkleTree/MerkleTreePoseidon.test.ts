/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

import { MerkleTree, toFixedHex } from '@webb-tools/sdk-core';
import { BigNumber } from 'ethers';
import { artifacts, contract } from 'hardhat';
import { poseidon } from 'circomlibjs';
const TruffleAssert = require('truffle-assertions');
const assert = require('assert');

const Poseidon = artifacts.require('PoseidonT3')
const MerkleTreeWithHistory = artifacts.require('MerkleTreePoseidonMock')

contract('MerkleTreePoseidon', (accounts) => {
  let merkleTreeWithHistory;
  let hasherInstance;
  let levels = 30;
  const sender = accounts[0];
  let tree: MerkleTree;

  beforeEach(async () => {
    hasherInstance = await Poseidon.new();
    tree = new MerkleTree(levels)
    merkleTreeWithHistory = await MerkleTreeWithHistory.new(levels, hasherInstance.address)
  })

  describe('#constructor', () => {
    it('should initialize', async () => {
      const zeroValue = await merkleTreeWithHistory.ZERO_VALUE()
      const firstSubtree = await merkleTreeWithHistory.filledSubtrees(0)
      assert.strictEqual(firstSubtree, toFixedHex(BigNumber.from(zeroValue.toString())));
      
      const firstZero = await merkleTreeWithHistory.zeros(0)
      assert.strictEqual(firstZero, toFixedHex(BigNumber.from(zeroValue.toString())));
    });
  });

  describe('#hash', () => {
    it('should hash', async () => {
      let contractResult = await hasherInstance.poseidon([10, 10]);
      let result = BigNumber.from(poseidon([10, 10]));
      assert.strictEqual(result.toString(), contractResult.toString());

      let zero_values = [];
      let current_zero_value = '21663839004416932945382355908790599225266501822907911457504978515578255421292'
      zero_values.push(current_zero_value)
      
      for (let i = 0; i < 31; i++) {
        current_zero_value = BigNumber.from(poseidon([i, current_zero_value, current_zero_value])).toString()
        zero_values.push(current_zero_value.toString())
      }
    });
  });

  describe('#insert', () => {
    it('should insert', async () => {
      let rootFromContract

      for (let i = 1; i < 11; i++) {
        await merkleTreeWithHistory.insert(toFixedHex(i), { from: sender })
        await tree.insert(i)
        let { merkleRoot } = await tree.path(i - 1)
        rootFromContract = await merkleTreeWithHistory.getLastRoot();
        assert.strictEqual(toFixedHex(merkleRoot), rootFromContract.toString());
      }
    });

    it('should reject if tree is full', async () => {
      const levels = 6
      const merkleTreeWithHistory = await MerkleTreeWithHistory.new(levels, hasherInstance.address)

      for (let i = 0; i < 2 ** levels; i++) {
        TruffleAssert.passes(await merkleTreeWithHistory.insert(toFixedHex(i + 42)))
      }

      await TruffleAssert.reverts(
        merkleTreeWithHistory.insert(toFixedHex(1337)),
        'Merkle tree is full. No more leaves can be added'
      );

      await TruffleAssert.reverts(
        merkleTreeWithHistory.insert(toFixedHex(1)),
        'Merkle tree is full. No more leaves can be added'
      );
    });
  })

  describe('#isKnownRoot', () => {
    it('should work', async () => {
      let path

      for (let i = 1; i < 5; i++) {
        TruffleAssert.passes(await merkleTreeWithHistory.insert(toFixedHex(i), { from: sender }))
        await tree.insert(i)
        path = await tree.path(i - 1)
        let isKnown = await merkleTreeWithHistory.isKnownRoot(toFixedHex(path.merkleRoot))
        assert(isKnown);
      }

      TruffleAssert.passes(await merkleTreeWithHistory.insert(toFixedHex(42), { from: sender }));
      // check outdated root
      let isKnown = await merkleTreeWithHistory.isKnownRoot(toFixedHex(path.merkleRoot))
      assert(isKnown);
    });

    it('should not return uninitialized roots', async () => {
      TruffleAssert.passes(await merkleTreeWithHistory.insert(toFixedHex(42), { from: sender }));
      let isKnown = await merkleTreeWithHistory.isKnownRoot(toFixedHex(0))
      assert(!isKnown);
    });
  });

  describe('#insertions using deposit commitments', async () =>  {
    it('should rebuild root correctly between native and contract', async () => {
      const merkleTreeWithHistory = await MerkleTreeWithHistory.new(levels, hasherInstance.address);
      const commitment = '0x0101010101010101010101010101010101010101010101010101010101010101';
      await tree.insert(commitment);
      const { merkleRoot, pathElements, pathIndices } = await tree.path(0);
      await merkleTreeWithHistory.insert(toFixedHex(commitment), { from: sender });
      const rootFromContract = await merkleTreeWithHistory.getLastRoot();
      assert.strictEqual(toFixedHex(merkleRoot), rootFromContract.toString());

      let curr = commitment;
      for (var i = 0; i < pathElements.length; i++) {
        let elt = pathElements[i];
        let side = pathIndices[i];
        if (side === 0) {
          let contractResult = await hasherInstance.poseidon([curr, elt]);
          curr = contractResult;
        } else {
          let contractResult = await hasherInstance.poseidon([elt, curr]);
          curr =  contractResult;
        }
      }

      assert.strictEqual(BigInt(curr).toString(), merkleRoot.toString());
    });
  });
});
