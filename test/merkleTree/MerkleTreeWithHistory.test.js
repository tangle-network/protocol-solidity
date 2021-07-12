/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');
const { ethers } = require('hardhat');

const Helpers = require('../helpers');
const assert = require('assert');

const MerkleTreeWithHistory = artifacts.require('MerkleTreeWithHistoryMock')
const MiMC = artifacts.require('MiMCSponge220');

const MerkleTree = require('../../lib/tornado-withdraw/MerkleTree')
const hasherImpl = require('../../lib/tornado-withdraw/MiMC')
const snarkjs = require('snarkjs')

const { ETH_AMOUNT, MERKLE_TREE_HEIGHT } = process.env

// eslint-disable-next-line no-unused-vars
function BNArrayToStringArray(array) {
  const arrayToPrint = []
  array.forEach((item) => {
    arrayToPrint.push(item.toString())
  })
  return arrayToPrint
}

function toFixedHex(number, length = 32) {
  let str = BigInt(number).toString(16)
  while (str.length < length * 2) str = '0' + str
  str = '0x' + str
  return str
}

contract('MerkleTreeWithHistory', (accounts) => {
  let web3;
  let merkleTreeWithHistory
  let hasherInstance
  let levels = MERKLE_TREE_HEIGHT || 16
  const sender = accounts[0]
  // eslint-disable-next-line no-unused-vars
  const value = ETH_AMOUNT || '1000000000000000000'
  let snapshotId
  let prefix = 'test'
  let tree

  before(async () => {
    hasherInstance = await MiMC.new();
    tree = new MerkleTree(levels, null, prefix)
    merkleTreeWithHistory = await MerkleTreeWithHistory.new(levels, hasherInstance.address)
  })

  describe('#constructor', () => {
    it('should initialize', async () => {
      const zeroValue = await merkleTreeWithHistory.ZERO_VALUE()
      const firstSubtree = await merkleTreeWithHistory.filledSubtrees(0)
      assert(firstSubtree, toFixedHex(zeroValue));
      
      const firstZero = await merkleTreeWithHistory.zeros(0)
      assert(firstZero, toFixedHex(zeroValue));
    });
  });

  describe('merkleTreeLib', () => {
    it('index_to_key', () => {
      assert(MerkleTree.index_to_key('test', 5, 20), 'test_tree_5_20')
    });

    it('tests insert', async () => {
      hasher = new hasherImpl()
      tree = new MerkleTree(2, null, prefix)
      await tree.insert(toFixedHex('5'))
      let { root, path_elements } = await tree.path(0);
      const calculated_root = hasher.hash(
        null,
        hasher.hash(null, '5', path_elements[0]),
        path_elements[1]
      );
      // console.log(root)
      assert(root, calculated_root)
    });

    it('creation odd elements count', async () => {
      const elements = [12, 13, 14, 15, 16, 17, 18, 19, 20]
      for (const [, el] of Object.entries(elements)) {
        await tree.insert(el)
      }

      const batchTree = new MerkleTree(levels, elements, prefix)
      for (const [i] of Object.entries(elements)) {
        const pathViaConstructor = await batchTree.path(i)
        const pathViaUpdate = await tree.path(i)
        assert(pathViaConstructor, pathViaUpdate);
      }
    });

    it('should find an element', async () => {
      const elements = [12, 13, 14, 15, 16, 17, 18, 19, 20]
      for (const [, el] of Object.entries(elements)) {
        await tree.insert(el)
      }
      let index = tree.getIndexByElement(13)
      assert(index, 1);

      index = tree.getIndexByElement(19)
      assert(index, 7);

      index = tree.getIndexByElement(12)
      assert(index, 0);

      index = tree.getIndexByElement(20)
      assert(index, 8);

      index = tree.getIndexByElement(42)
      assert(index, false);
    })

    it('creation even elements count', async () => {
      const elements = [12, 13, 14, 15, 16, 17]
      for (const [, el] of Object.entries(elements)) {
        await tree.insert(el)
      }

      const batchTree = new MerkleTree(levels, elements, prefix)
      for (const [i] of Object.entries(elements)) {
        const pathViaConstructor = await batchTree.path(i)
        const pathViaUpdate = await tree.path(i)
        assert(pathViaConstructor, pathViaUpdate);
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

  describe('#insert', () => {
    it('should insert', async () => {
      let rootFromContract

      for (let i = 1; i < 11; i++) {
        await merkleTreeWithHistory.insert(toFixedHex(i), { from: sender })
        await tree.insert(i)
        let { root } = await tree.path(i - 1)
        rootFromContract = await merkleTreeWithHistory.getLastRoot()
        assert(toFixedHex(root), rootFromContract.toString());
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
        TruffleAssert.passes(await merkleTreeWithHistory.insert(toFixedHex(i), { from: sender }))
        await tree.insert(i)
        path = await tree.path(i - 1)
        let isKnown = await merkleTreeWithHistory.isKnownRoot(toFixedHex(path.root))
        assert(isKnown, true);
      }

      TruffleAssert.passes(await merkleTreeWithHistory.insert(toFixedHex(42), { from: sender }));
      // check outdated root
      let isKnown = await merkleTreeWithHistory.isKnownRoot(toFixedHex(path.root))
      assert(isKnown, true);
    })

    it('should not return uninitialized roots', async () => {
      TruffleAssert.passes(await merkleTreeWithHistory.insert(toFixedHex(42), { from: sender }));
      let isKnown = await merkleTreeWithHistory.isKnownRoot(toFixedHex(0))
      assert(isKnown, false);
    })
  });
});
