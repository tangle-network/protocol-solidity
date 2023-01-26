/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

const { expect } = require('chai');
import {
  Keypair,
  generateVariableWitnessInput,
  getVAnchorExtDataHash,
  CircomUtxo,
  MerkleTree,
  toFixedHex,
  toBuffer,
  randomBN
} from '@webb-tools/sdk-core';
import { PoseidonHasher, VAnchor } from '@webb-tools/anchors';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { poseidon } from 'circomlibjs';
import { getChainIdType, hexToU8a, u8aToHex, ZkComponents, fetchComponentsFromFilePaths } from '@webb-tools/utils';
import { Verifier } from '@webb-tools/vbridge';
import {
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  FungibleTokenWrapper as WrappedToken,
  FungibleTokenWrapper__factory as WrappedTokenFactory,
} from '@webb-tools/contracts'
const snarkjs = require('snarkjs');
const path = require('path');

// const MerkleTreeWithHistory = artifacts.require('MerkleTreePoseidonMock');

// const instances = [
//   '0x1111000000000000000000000000000000001111',
//   '0x2222000000000000000000000000000000002222',
//   '0x3333000000000000000000000000000000003333',
//   '0x4444000000000000000000000000000000004444',
// ]

const blocks = ['0xaaaaaaaa', '0xbbbbbbbb', '0xcccccccc', '0xdddddddd'];

describe.only('Reward snarkjs local proof', () => {
  let unspentTree: MerkleTree;
  let spentTree: MerkleTree;
  // VAnchor-like contract's merkle-tree
  let vanchorMerkleTree: MerkleTree;
  // VAnchor-like contract's merkle-tree for the AP tokens
  let rewardMerkleTree: MerkleTree;
  let token: ERC20PresetMinterPauser;
  let sender: SignerWithAddress;
  let wrappedToken: WrappedToken;
  let zkComponent: ZkComponents;
  let emptyTreeRoot: BigNumber;

  const chainID = getChainIdType(31337);
  const levels = 30;
  let tokenDenomination = '1000000000000000000'; // 1 ether

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

  before('should initialize trees and vanchor', async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;

    unspentTree = new MerkleTree(levels);
    spentTree = new MerkleTree(levels);
    vanchorMerkleTree = new MerkleTree(levels);
    rewardMerkleTree = new MerkleTree(levels);
    emptyTreeRoot = vanchorMerkleTree.root();

    zkComponent = await fetchComponentsFromFilePaths(
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/reward_2/30/reward_30_2.wasm'
      ),
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/reward_2/30/witness_calculator.cjs'
      ),
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/reward_2/30/circuit_final.zkey'
      )
    );

  });

  it('should work', async () => {
    // create deposit UTXO
    const aliceDepositAmount = 1e7;
    const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);
    const alicePrivateKey = aliceDepositUtxo.getKeypair().privkey;
    const aliceCommitment = toFixedHex(aliceDepositUtxo.commitment)
    await vanchorMerkleTree.insert(aliceCommitment)
    expect(vanchorMerkleTree.number_of_elements()).to.equal(1);
    const UTXOPath = vanchorMerkleTree.path(0)
    const UTXOPathElements = UTXOPath.pathElements.map((bignum: BigNumber) => bignum.toString())
    const UTXOPathIndices = MerkleTree.calculateIndexFromPathIndices(UTXOPath.pathIndices);

    // Update depositTree with vanchor UTXO commitment
    const unspentTimestamp = Date.now();
    const unspentLeaf = poseidon([aliceCommitment, unspentTimestamp]);
    await unspentTree.insert(unspentLeaf)
    expect(unspentTree.number_of_elements()).to.equal(1);

    const spentTimestamp = Date.now() + 1000;

    const aliceNullifier = '0x' + aliceDepositUtxo.nullifier
    const spentLeaf = poseidon([aliceNullifier, spentTimestamp]);
    await spentTree.insert(spentLeaf)
    expect(spentTree.number_of_elements()).to.equal(1);

    const rate = 1000;
    const fee = 0;

    // empty/dummy input AP-VAnchor UTXO
    const inputAmount = 0
    const rewardInputUtxo = await generateUTXOForTest(chainID, inputAmount);
    const inputPrivateKey = rewardInputUtxo.getKeypair().privkey
    const inputRoot = rewardMerkleTree.root().toString();
    const inputPathElements = new Array(rewardMerkleTree.levels).fill(0);
    const inputPathIndices = MerkleTree.calculateIndexFromPathIndices(new Array(rewardMerkleTree.levels).fill(0));

    const outputAmount = (rate * (spentTimestamp - unspentTimestamp)) * aliceDepositAmount
    const rewardOutputUtxo = await generateUTXOForTest(chainID, outputAmount);
    const outputCommitment = toFixedHex(rewardOutputUtxo.commitment)
    const outputPrivateKey = rewardOutputUtxo.getKeypair().privkey
    const unspentRoots = [unspentTree.root().toString(), emptyTreeRoot.toString()]
    const unspentPath = unspentTree.path(0);
    const unspentPathElements = unspentPath.pathElements.map((bignum: BigNumber) => bignum.toString())
    const unspentPathIndices = MerkleTree.calculateIndexFromPathIndices(unspentPath.pathIndices);

    expect(spentTree.number_of_elements()).to.equal(1);
    const spentRoots = [spentTree.root().toString(), emptyTreeRoot.toString()]
    const spentPath = spentTree.path(0);
    const spentPathElements = spentPath.pathElements.map((bignum: BigNumber) => bignum.toString())
    const spentPathIndices = MerkleTree.calculateIndexFromPathIndices(spentPath.pathIndices);

    const rewardNullifier = poseidon([aliceNullifier, UTXOPathIndices]);

    const circuitInput = {
      rate,
      fee,
      rewardNullifier,
      // Dummy
      extDataHash: randomBN(31).toHexString(),

      noteChainID: chainID,
      noteAmount: aliceDepositUtxo.amount,
      notePrivateKey: alicePrivateKey,
      noteBlinding: '0x' + aliceDepositUtxo.blinding,
      notePathElements: UTXOPathElements,
      notePathIndices: UTXOPathIndices,

      // inputs prefixed with input correspond to the vanchor utxos
      inputChainID: chainID,
      inputAmount: rewardInputUtxo.amount,
      inputPrivateKey: inputPrivateKey,
      inputBlinding: '0x' + rewardInputUtxo.blinding,
      inputNullifier: '0x' + rewardInputUtxo.nullifier,
      inputRoot,
      inputPathElements,
      inputPathIndices,

      outputChainID: chainID,
      outputAmount: outputAmount,
      outputPrivateKey: outputPrivateKey,
      outputBlinding: '0x' + rewardOutputUtxo.blinding,
      outputCommitment: toFixedHex(rewardOutputUtxo.commitment),
      unspentTimestamp: unspentTimestamp,
      unspentRoots: unspentRoots,
      unspentPathIndices: unspentPathIndices,
      unspentPathElements: unspentPathElements,
      spentTimestamp: spentTimestamp,
      spentRoots: spentRoots,
      spentPathIndices: spentPathIndices,
      spentPathElements: spentPathElements,
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInput,
      zkComponent.wasm,
      zkComponent.zkey
    );
    const vKey = await snarkjs.zKey.exportVerificationKey(zkComponent.zkey);
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    expect(verified).to.equal(true);
  })
})
