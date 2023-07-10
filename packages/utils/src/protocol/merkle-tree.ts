// Copyright 2022-2023 Webb Technologies Inc.
// SPDX-License-Identifier: Apache-2.0
// This file has been modified by Webb Technologies Inc.

import { poseidon } from 'circomlibjs';
import { BigNumber, BigNumberish } from 'ethers';

import { toFixedHex } from '../utils';

const DEFAULT_ZERO: BigNumberish =
  '21663839004416932945382355908790599225266501822907911457504978515578255421292';

function poseidonHash(left: BigNumberish, right: BigNumberish) {
  return BigNumber.from(poseidon([BigNumber.from(left), BigNumber.from(right)]));
}

export type MerkleProof = {
  element: BigNumber;
  merkleRoot: BigNumber;
  pathElements: BigNumber[];
  pathIndices: number[];
};

/**
 * Merkle tree
 */
export class MerkleTree {
  levels: number;
  capacity: number;
  _hash: (left: BigNumberish, right: BigNumberish) => BigNumber;
  zeroElement: BigNumber;
  _zeros: BigNumber[];
  _layers: BigNumber[][];

  /**
   * Constructor
   * @param levels - Number of levels in the tree
   * @param elements - BigNumberish[] of initial elements
   * @param options - Object with the following properties:
   *    hashFunction - Function used to hash 2 leaves
   *    zeroElement - Value for non-existent leaves
   */
  constructor(
    levels: number | string,
    elements: BigNumberish[] = [],
    { hashFunction = poseidonHash, zeroElement = DEFAULT_ZERO } = {}
  ) {
    levels = Number(levels);
    this.levels = levels;
    this.capacity = 2 ** levels;

    if (elements.length > this.capacity) {
      throw new Error('Tree is full');
    }

    this._hash = hashFunction;
    this.zeroElement = BigNumber.from(zeroElement);
    this._zeros = [];
    this._zeros[0] = BigNumber.from(zeroElement);

    for (let i = 1; i <= levels; i++) {
      this._zeros[i] = this._hash(this._zeros[i - 1], this._zeros[i - 1]);
    }

    this._layers = [];
    this._layers[0] = elements.slice().map((e) => BigNumber.from(e));
    this._rebuild();
  }

  _rebuild() {
    for (let level = 1; level <= this.levels; level++) {
      this._layers[level] = [];

      for (let i = 0; i < Math.ceil(this._layers[level - 1].length / 2); i++) {
        this._layers[level][i] = this._hash(
          this._layers[level - 1][i * 2],
          i * 2 + 1 < this._layers[level - 1].length
            ? this._layers[level - 1][i * 2 + 1]
            : this._zeros[level - 1]
        );
      }
    }
  }

  /**
   * Get tree root
   * @returns
   */
  root(): BigNumber {
    return this._layers[this.levels].length > 0
      ? this._layers[this.levels][0]
      : this._zeros[this.levels];
  }

  /**
   * Insert new element into the tree
   * @param element - Element to insert
   */
  insert(element: BigNumberish) {
    if (this._layers[0].length >= this.capacity) {
      throw new Error('Tree is full');
    }

    this.update(this._layers[0].length, BigNumber.from(element));
  }

  bulkRemove(elements: BigNumberish[]) {
    for (const elem of elements) {
      this.remove(elem);
    }
  }

  remove(element: BigNumberish) {
    const index = this.indexOf(element);

    if (index === -1) {
      throw new Error('Element is not in the merkle tree');
    }

    this.removeByIndex(index);
  }

  removeByIndex(index: number) {
    this.update(index, this.zeroElement);
  }

  /**
   * Insert multiple elements into the tree.
   * @param elements - Elements to insert
   */
  bulkInsert(elements: BigNumberish[]) {
    if (this._layers[0].length + elements.length > this.capacity) {
      throw new Error('Tree is full');
    }

    // First we insert all elements except the last one
    // updating only full subtree hashes (all layers where inserted element has odd index)
    // the last element will update the full path to the root making the tree consistent again
    for (let i = 0; i < elements.length - 1; i++) {
      this._layers[0].push(BigNumber.from(elements[i]));
      let level = 0;
      let index = this._layers[0].length - 1;

      while (index % 2 === 1) {
        level++;
        index >>= 1;
        this._layers[level][index] = this._hash(
          this._layers[level - 1][index * 2],
          this._layers[level - 1][index * 2 + 1]
        );
      }
    }

    this.insert(elements[elements.length - 1]);
  }

  /**
   * Change an element in the tree
   * @param index - Index of element to change
   * @param element - Updated element value
   */
  update(index: number, element: BigNumberish) {
    if (
      isNaN(Number(index)) ||
      index < 0 ||
      index > this._layers[0].length ||
      index >= this.capacity
    ) {
      throw new Error('Insert index out of bounds: ' + index);
    }

    this._layers[0][index] = BigNumber.from(element);

    for (let level = 1; level <= this.levels; level++) {
      index >>= 1;
      this._layers[level][index] = this._hash(
        this._layers[level - 1][index * 2],
        index * 2 + 1 < this._layers[level - 1].length
          ? this._layers[level - 1][index * 2 + 1]
          : this._zeros[level - 1]
      );
    }
  }

  /**
   * Get merkle path to a leaf
   * @param index - Leaf index to generate path for
   * @returns pathElements: Object[], pathIndex: number[] - An object containing adjacent elements and left-right index
   */
  path(index: number): MerkleProof {
    if (isNaN(Number(index)) || index < 0 || index >= this._layers[0].length) {
      throw new Error('Index out of bounds: ' + index);
    }

    const pathElements = [];
    const pathIndices = [];

    for (let level = 0; level < this.levels; level++) {
      pathIndices[level] = index % 2;
      pathElements[level] =
        (index ^ 1) < this._layers[level].length
          ? this._layers[level][index ^ 1]
          : this._zeros[level];
      index >>= 1;
    }

    return {
      element: this._layers[0][index],
      merkleRoot: this.root(),
      pathElements,
      pathIndices,
    };
  }

  /**
   * Find an element in the tree
   * @param element - An element to find
   * @returns number - Index if element is found, otherwise -1
   */
  indexOf(element: BigNumberish): number {
    return this._layers[0].findIndex((el) => el.eq(BigNumber.from(element)));
  }

  /**
   * Returns a copy of non-zero tree elements
   * @returns Object[]
   */
  elements() {
    return this._layers[0].slice();
  }

  /**
   * Returns a copy of n-th zero elements array
   * @returns Object[]
   */
  zeros() {
    return this._zeros.slice();
  }

  /**
   * Serialize entire tree state including intermediate layers into a plain object
   * Deserializing it back will not require to recompute any hashes
   * Elements are not converted to a plain type, this is responsibility of the caller
   */
  serialize() {
    return {
      _layers: this._layers,
      _zeros: this._zeros,
      levels: this.levels,
    };
  }

  number_of_elements() {
    return this._layers[0].length;
  }

  getIndexByElement(element: BigNumberish): number {
    return this.indexOf(element);
  }

  /**
   * Deserialize data into a MerkleTree instance
   * Make sure to provide the same hashFunction as was used in the source tree,
   * otherwise the tree state will be invalid
   */
  static deserialize(data: any, hashFunction: any) {
    const instance = Object.assign(Object.create(this.prototype), data);

    instance._hash = hashFunction || poseidon;
    instance.capacity = 2 ** instance.levels;
    instance.zeroElement = instance._zeros[0];

    return instance;
  }

  /**
   * Create a merkle tree with the target root by inserting the given leaves
   * one-by-one.
   * If the root matches after an insertion, return the tree.
   * Else, return undefined.
   *
   * @param leaves - An array of ordered leaves to be inserted in a merkle tree
   * @param targetRoot - The root that the caller is trying to build a tree against
   * @returns MerkleTree | undefined
   */
  static createTreeWithRoot(
    levels: number,
    leaves: string[],
    targetRoot: string
  ): MerkleTree | undefined {
    if (leaves.length > Math.pow(2, levels)) {
      return undefined;
    }

    const tree = new MerkleTree(levels, []);

    for (let i = 0; i < leaves.length; i++) {
      tree.insert(leaves[i]);
      const nextRoot = tree.root();

      if (toFixedHex(nextRoot) === targetRoot) {
        return tree;
      }
    }

    return undefined;
  }

  /**
   * This function calculates the desired index given the pathIndices
   *
   * @param pathIndices - an array of (0, 1) values representing (left, right) selection
   * of nodes for each level in the merkle tree. The leaves level of the tree is at index 0
   * and the root of the tree is at index 'levels'
   */
  static calculateIndexFromPathIndices(pathIndices: number[]) {
    return pathIndices.reduce((value, isRight, level) => {
      let addedValue = value;

      if (isRight) {
        addedValue = value + 2 ** level;
      }

      return addedValue;
    });
  }
}
