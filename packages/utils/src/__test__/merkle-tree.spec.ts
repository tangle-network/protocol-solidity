// Copyright 2022-2023 Webb Technologies Inc.
// SPDX-License-Identifier: Apache-2.0

import { expect } from 'chai';
import { MerkleTree } from '../protocol/merkle-tree';

describe('Merkle Tree tests', () => {
  const elements = [12, 13, 14, 15, 16, 17, 18, 19, 20];

  describe('construction tests', () => {
    it('should evaluate the same for constructor with elements and constructor with insertions', () => {
      const treeWithElements = new MerkleTree(15, elements);

      const treeThenInsert = new MerkleTree(15);

      for (const element of elements) {
        treeThenInsert.insert(element);
      }

      expect(treeThenInsert.root().toHexString()).to.eq(treeWithElements.root().toHexString());
    });
  });

  describe('insertion tests', () => {
    it('should evaluate the same for bulkInsert and single insert', () => {
      const singleTree = new MerkleTree(6);
      const bulkTree = new MerkleTree(6);

      bulkTree.bulkInsert(elements);

      for (const el of elements) {
        singleTree.insert(el);
      }

      for (let i = 0; i < elements.length; i++) {
        const bulkPath = bulkTree.path(i);
        const singlePath = singleTree.path(i);

        expect(bulkPath.merkleRoot.toHexString()).to.eq(singlePath.merkleRoot.toHexString());
        expect(bulkPath.element.toHexString()).to.eq(singlePath.element.toHexString());
        expect(bulkPath.pathIndices).to.eql(singlePath.pathIndices);
        expect(bulkPath.pathElements).to.eql(singlePath.pathElements);
      }
    });

    it('should find an element', async () => {
      const tree = new MerkleTree(20);

      tree.bulkInsert(elements);
      let index = tree.getIndexByElement(13);

      expect(index).to.eq(1);

      index = tree.getIndexByElement(19);
      expect(index).to.eq(7);

      index = tree.getIndexByElement(12);
      expect(index).to.eq(0);

      index = tree.getIndexByElement(20);
      expect(index).to.eq(8);

      index = tree.getIndexByElement(42);
      expect(index).to.eq(-1);
    });
  });

  describe('removal tests', () => {
    let singleTree: MerkleTree;
    let bulkTree: MerkleTree;
    let initialRoot: any; // BigNumber

    before(async () => {
      singleTree = new MerkleTree(6);
      bulkTree = new MerkleTree(6);
      initialRoot = singleTree.root();

      bulkTree.bulkInsert(elements);

      for (const el of elements) {
        singleTree.insert(el);
      }

      for (let i = 0; i < elements.length; i++) {
        const bulkPath = bulkTree.path(i);
        const singlePath = singleTree.path(i);

        expect(bulkPath.merkleRoot.toHexString()).to.eq(singlePath.merkleRoot.toHexString());
        expect(bulkPath.element.toHexString()).to.eq(singlePath.element.toHexString());
        expect(bulkPath.pathIndices).to.eql(singlePath.pathIndices);
        expect(bulkPath.pathElements).to.eql(singlePath.pathElements);
      }
    });

    it('should evaluate the same for removeBulk and single remove', () => {
      bulkTree.bulkRemove(elements);

      for (const el of elements) {
        singleTree.remove(el);
      }

      for (let i = 0; i < elements.length; i++) {
        const bulkPath = bulkTree.path(i);
        const singlePath = singleTree.path(i);

        expect(bulkPath.merkleRoot.toHexString()).to.eq(singlePath.merkleRoot.toHexString());
        expect(bulkPath.element.toHexString()).to.eq(singlePath.element.toHexString());
        expect(bulkPath.pathIndices).to.eql(singlePath.pathIndices);
        expect(bulkPath.pathElements).to.eql(singlePath.pathElements);
      }

      expect(bulkTree.root().toHexString()).to.eq(singleTree.root().toHexString());
      // checking if root matches root without any elements as all of them have been removed
      expect(bulkTree.root().toHexString()).to.eq(initialRoot.toHexString());
    });
  });

  it('should correctly calculate the index from pathIndices', () => {
    const pathIndices = [0, 1, 1, 0, 1];
    const calculatedIndex = MerkleTree.calculateIndexFromPathIndices(pathIndices);

    expect(calculatedIndex).to.eq(22);
  });
});
