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
  let depositTree: MerkleTree;
  let withdrawalTree: MerkleTree;
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

    depositTree = new MerkleTree(levels);
    withdrawalTree = new MerkleTree(levels);
    vanchorMerkleTree = new MerkleTree(levels);
    rewardMerkleTree = new MerkleTree(levels);
    emptyTreeRoot = vanchorMerkleTree.root();

    zkComponent = await fetchComponentsFromFilePaths(
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/reward/30/rewardMain.wasm'
      ),
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/reward/30/witness_calculator.cjs'
      ),
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/reward/30/circuit_final.zkey'
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
    const depositTimestamp = Date.now();
    console.log("Alice deposited: ", aliceCommitment, " at ", depositTimestamp)
    const depositLeaf = poseidon([aliceCommitment, depositTimestamp]);
    console.log("depositLeaf: ", depositLeaf)
    await depositTree.insert(depositLeaf)
    expect(depositTree.number_of_elements()).to.equal(1);

    const withdrawTimestamp = Date.now() + 1000;

    const aliceNullifier = '0x' + aliceDepositUtxo.nullifier
    const withdrawLeaf = poseidon([aliceNullifier, withdrawTimestamp]);
    await withdrawalTree.insert(withdrawLeaf)
    expect(withdrawalTree.number_of_elements()).to.equal(1);

    console.log("Nullifier: ", aliceNullifier)
    console.log("withdrawLeaf: ", withdrawLeaf)

    const rate = 1000;
    const fee = 0;

    // empty/dummy input AP-VAnchor UTXO
    const inputAmount = 0
    const rewardInputUtxo = await generateUTXOForTest(chainID, inputAmount);
    const inputPrivateKey = rewardInputUtxo.getKeypair().privkey
    const inputRoot = rewardMerkleTree.root().toString();
    const inputPathElements = new Array(rewardMerkleTree.levels).fill(0);
    const inputPathIndices = MerkleTree.calculateIndexFromPathIndices(new Array(rewardMerkleTree.levels).fill(0));

    const outputAmount = (rate * (withdrawTimestamp - depositTimestamp)) * aliceDepositAmount
    console.log("inputAmount: ", inputAmount)
    console.log("outputAmount: ", outputAmount)
    const rewardOutputUtxo = await generateUTXOForTest(chainID, outputAmount);
    console.log("rewardOutputUtxo: ", rewardOutputUtxo)
    const outputCommitment = toFixedHex(rewardOutputUtxo.commitment)
    const outputPrivateKey = rewardOutputUtxo.getKeypair().privkey
    await rewardMerkleTree.insert(outputCommitment);

    expect(rewardMerkleTree.number_of_elements()).to.equal(1);
    const outputRoot = rewardMerkleTree.root().toString();
    const outputPath = rewardMerkleTree.path(0);

    const outputPathElements = outputPath.pathElements.map((bignum: BigNumber) => bignum.toString())
    const outputPathIndices = MerkleTree.calculateIndexFromPathIndices(outputPath.pathIndices);
    const depositRoots = [depositTree.root().toString(), emptyTreeRoot.toString()]
    const depositPath = depositTree.path(0);
    const depositPathElements = depositPath.pathElements.map((bignum: BigNumber) => bignum.toString())
    const depositPathIndices = MerkleTree.calculateIndexFromPathIndices(depositPath.pathIndices);

    expect(withdrawalTree.number_of_elements()).to.equal(1);
    const withdrawRoots = [withdrawalTree.root().toString(), emptyTreeRoot.toString()]
    const withdrawalPath = withdrawalTree.path(0);
    const withdrawPathElements = withdrawalPath.pathElements.map((bignum: BigNumber) => bignum.toString())
    const withdrawPathIndices = MerkleTree.calculateIndexFromPathIndices(withdrawalPath.pathIndices);

    const rewardNullifier = poseidon([aliceNullifier]);
    console.log('rewardNullifier: ', rewardNullifier)

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
      outputRoot,
      outputPathIndices,
      outputPathElements,
      spentTimestamp: depositTimestamp,
      spentRoots: depositRoots,
      spentPathIndices: depositPathIndices,
      spentPathElements: depositPathElements,
      unspentTimestamp: withdrawTimestamp,
      unspentRoots: withdrawRoots,
      unspentPathIndices: withdrawPathIndices,
      unspentPathElements: withdrawPathElements,
    }
    console.log('circuitInputs: ', circuitInput)

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInput,
      zkComponent.wasm,
      zkComponent.zkey
    );
    const vKey = await snarkjs.zKey.exportVerificationKey(zkComponent.zkey);
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    expect(verified).to.equal(true);

      // inputs prefixed with output correspond to the anonimity points vanchor
      // outputChainID:
      // outputAmount:
      // outputPrivateKey:
      // outputBlinding:
      // outputRoot:
      // outputPathIndices:
      // outputPathElements[levels]:
      // outputCommitment:

  // inputs prefixed with deposit correspond to the depositMerkleTree
  // signal input depositTimestamp:
  // signal input depositRoots[length]:
  // signal input depositPathIndices:
  // signal input depositPathElements[levels]:

  // inputs prefixed with withdrawal correspond to the withdrawMerkleTree
  // signal input withdrawTimestamp:
  // signal input withdrawRoots[length]:
  // signal input withdrawPathIndices:
  // signal input withdrawPathElements[levels]:

  })
})
