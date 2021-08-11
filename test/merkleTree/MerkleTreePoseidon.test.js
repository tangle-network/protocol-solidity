/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
const TruffleAssert = require('truffle-assertions');
const { ethers } = require('hardhat');
const BN = require('bn.js');
const helpers = require('../helpers');
const assert = require('assert');

const MerkleTreeWithHistory = artifacts.require('MerkleTreePoseidonMock')
const Poseidon = artifacts.require('PoseidonT3');

const MerkleTree = require('../../lib/MerkleTree')
const hasherImpl = require('../../lib/Poseidon')
const snarkjs = require('snarkjs');
const { collapseTextChangeRangesAcrossMultipleVersions } = require('typescript');

const { ETH_AMOUNT, MERKLE_TREE_HEIGHT } = process.env

// eslint-disable-next-line no-unused-vars
function BNArrayToStringArray(array) {
  const arrayToPrint = []
  array.forEach((item) => {
    arrayToPrint.push(item.toString())
  })
  return arrayToPrint
}

contract('MerkleTreePoseidon', (accounts) => {
  let web3;
  let merkleTreeWithHistory;
  let HasherFactory;
  let hasherInstance;
  let levels = MERKLE_TREE_HEIGHT || 30;
  const sender = accounts[0];
  // eslint-disable-next-line no-unused-vars
  const value = ETH_AMOUNT || '1000000000000000000';
  let snapshotId;
  let prefix = 'test';
  let tree;

  beforeEach(async () => {
    const accounts = await hre.ethers.getSigners()
    hasherInstance = await Poseidon.new();
    tree = new MerkleTree(levels, null, prefix)
    merkleTreeWithHistory = await MerkleTreeWithHistory.new(levels, hasherInstance.address)
  })

  describe('#constructor', () => {
    it('should initialize', async () => {
      const zeroValue = await merkleTreeWithHistory.ZERO_VALUE()
      const firstSubtree = await merkleTreeWithHistory.filledSubtrees(0)
      assert.strictEqual(firstSubtree, helpers.toFixedHex(zeroValue));
      
      const firstZero = await merkleTreeWithHistory.zeros(0)
      assert.strictEqual(firstZero, helpers.toFixedHex(zeroValue));
    });
  });

  describe('merkleTreeLib', () => {
    it('index_to_key', () => {
      assert(MerkleTree.index_to_key('test', 5, 20) == 'test_tree_5_20')
    });

    it('tests insert', async () => {
      hasher = new hasherImpl()
      tree = new MerkleTree(2, null, prefix)
      await tree.insert(helpers.toFixedHex('5'))
      let { root, path_elements } = await tree.path(0);
      const calculated_root = hasher.hash(
        null,
        hasher.hash(null, '5', path_elements[0]),
        path_elements[1]
      );
      // console.log(root)
      assert(root == calculated_root)
    });

    it('creation odd elements count', async () => {
      tree = new MerkleTree(levels, null, prefix)
      const elements = [12, 13, 14, 15, 16, 17, 18, 19, 20]
      for (const [, el] of Object.entries(elements)) {
        await tree.insert(el)
      }

      const batchTree = new MerkleTree(levels, elements, prefix)
      for (const [i] of Object.entries(elements)) {
        const pathViaConstructor = await batchTree.path(i)
        const pathViaUpdate = await tree.path(i)
        assert.deepStrictEqual(pathViaConstructor, pathViaUpdate);
      }
    });

    it('should find an element', async () => {
      tree = new MerkleTree(levels, null, prefix)
      const elements = [12, 13, 14, 15, 16, 17, 18, 19, 20]
      for (const [, el] of Object.entries(elements)) {
        await tree.insert(el)
      }
      let index = tree.getIndexByElement(13)
      assert(index == 1);

      index = tree.getIndexByElement(19)
      assert(index == 7);

      index = tree.getIndexByElement(12)
      assert(index == 0);

      index = tree.getIndexByElement(20)
      assert(index == 8);

      index = tree.getIndexByElement(42)
      assert(index == false);
    })

    it('creation even elements count', async () => {
      const tree = new MerkleTree(levels, null, prefix)
      const elements = [12, 13, 14, 15, 16, 17]
      for (const [, el] of Object.entries(elements)) {
        await tree.insert(el)
      }

      const batchTree = new MerkleTree(levels, elements, prefix)
      for (const [i] of Object.entries(elements)) {
        const pathViaConstructor = await batchTree.path(i)
        const pathViaUpdate = await tree.path(i)
        assert.deepStrictEqual(pathViaConstructor, pathViaUpdate);
      }
    })

    it.skip('creation using 30000 elements', () => {
      const elements = []
      for (let i = 1000; i < 31001; i++) {
        elements.push(i)
      }
      console.time('MerkleTree')
      tree = new MerkleTree(levels, elements, prefix)
      console.timeEnd('MerkleTree')
      // 2,7 GHz Intel Core i7
      // 1000 : 1949.084ms
      // 10000: 19456.220ms
      // 30000: 63406.679ms
    })
  })

  describe('#hash', () => {
    it('should hash', async () => {
      hasher = new hasherImpl()
      let contractResult = await hasherInstance.poseidon([10, 10]);
      let result = hasher.hash(null, 10, 10);
      assert.strictEqual(result.toString(), contractResult.toString());

      let zero_values = [];
      let current_zero_value = '21663839004416932945382355908790599225266501822907911457504978515578255421292'
      zero_values.push(current_zero_value)
      // console.log(new BN(current_zero_value.toString()).toString(16));
      for (let i = 0; i < 31; i++) {
        current_zero_value = hasher.hash(i, current_zero_value, current_zero_value)
        // console.log(new BN(current_zero_value.toString()).toString(16));
        zero_values.push(current_zero_value.toString())
      }
    });
  });

  describe('#insert', () => {
    it('should insert', async () => {
      let rootFromContract

      for (let i = 1; i < 11; i++) {
        await merkleTreeWithHistory.insert(helpers.toFixedHex(i), { from: sender })
        await tree.insert(i)
        let { root } = await tree.path(i - 1)
        rootFromContract = await merkleTreeWithHistory.getLastRoot();
        assert.strictEqual(helpers.toFixedHex(root), rootFromContract.toString());
      }
    });

    it('should reject if tree is full', async () => {
      const levels = 6
      const merkleTreeWithHistory = await MerkleTreeWithHistory.new(levels, hasherInstance.address)

      for (let i = 0; i < 2 ** levels; i++) {
        TruffleAssert.passes(await merkleTreeWithHistory.insert(helpers.toFixedHex(i + 42)))
      }

      await TruffleAssert.reverts(
        merkleTreeWithHistory.insert(helpers.toFixedHex(1337)),
        'Merkle tree is full. No more leaves can be added'
      );

      await TruffleAssert.reverts(
        merkleTreeWithHistory.insert(helpers.toFixedHex(1)),
        'Merkle tree is full. No more leaves can be added'
      );
    })

    it.skip('hasher gas', async () => {
      const levels = 6
      const merkleTreeWithHistory = await MerkleTreeWithHistory.new(levels)
      const zeroValue = await merkleTreeWithHistory.zeroValue()

      const gas = await merkleTreeWithHistory.hashLeftRight.estimateGas(zeroValue, zeroValue)
      console.log('gas', gas - 21000)
    })
  })

  describe('#isKnownRoot', () => {
    it('should work', async () => {
      let path

      for (let i = 1; i < 5; i++) {
        TruffleAssert.passes(await merkleTreeWithHistory.insert(helpers.toFixedHex(i), { from: sender }))
        await tree.insert(i)
        path = await tree.path(i - 1)
        let isKnown = await merkleTreeWithHistory.isKnownRoot(helpers.toFixedHex(path.root))
        assert(isKnown);
      }

      TruffleAssert.passes(await merkleTreeWithHistory.insert(helpers.toFixedHex(42), { from: sender }));
      // check outdated root
      let isKnown = await merkleTreeWithHistory.isKnownRoot(helpers.toFixedHex(path.root))
      assert(isKnown);
    });

    it('should not return uninitialized roots', async () => {
      TruffleAssert.passes(await merkleTreeWithHistory.insert(helpers.toFixedHex(42), { from: sender }));
      let isKnown = await merkleTreeWithHistory.isKnownRoot(helpers.toFixedHex(0))
      assert(!isKnown);
    });
  });

  describe('#insertions using deposit commitments', async () =>  {
    it('should rebuild root correctly between native and contract', async () => {
      const merkleTreeWithHistory = await MerkleTreeWithHistory.new(levels, hasherInstance.address);
      const deposit = helpers.generateDeposit();
      const commitment = deposit.commitment;
      await tree.insert(commitment);
      const { root, path_elements, path_index } = await tree.path(0);
      await merkleTreeWithHistory.insert(helpers.toFixedHex(commitment), { from: sender });
      rootFromContract = await merkleTreeWithHistory.getLastRoot();
      assert.strictEqual(helpers.toFixedHex(root), rootFromContract.toString());

      let curr = deposit.commitment;
      for (var i = 0; i < path_elements.length; i++) {
        let elt = path_elements[i];
        let side = path_index[i];
        if (side === 0) {
          let contractResult = await hasherInstance.poseidon([curr, elt]);
          curr = contractResult;
        } else {
          let contractResult = await hasherInstance.poseidon([elt, curr]);
          curr =  contractResult;
        }
      }

      assert.strictEqual(helpers.toFixedHex(curr), helpers.toFixedHex(root));
    });
  });
});
