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
  let zkComponents: ZkComponents;

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

    zkComponents = await fetchComponentsFromFilePaths(
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
    const aliceDepositAmount = 1e7;
    const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);
    const aliceDepositCommitment = toFixedHex(aliceDepositUtxo.commitment)
    const depositTimestamp = Date.now();
    console.log("Alice deposited: ", aliceDepositCommitment, " at ", depositTimestamp)
    await vanchorMerkleTree.insert(aliceDepositCommitment)
    const depositLeaf = poseidon([aliceDepositCommitment, depositTimestamp]);
    console.log("depositLeaf: ", depositLeaf)
    await depositTree.insert(depositLeaf)

    const aliceWithdrawAmount = aliceDepositAmount;
    const aliceWithdrawalUtxo = await CircomUtxo.generateUtxo({
      curve: 'Bn254',
      backend: 'Circom',
      chainId: chainID.toString(),
      originChainId: chainID.toString(),
      amount: aliceWithdrawAmount.toString(),
      keypair: aliceDepositUtxo.keypair,
    });

    const withdrawalTimestamp = Date.now() + 10_000;
    const depositNullifier = '0x' + aliceDepositUtxo.nullifier
    console.log("deposit nullifier: ", depositNullifier, " at ", withdrawalTimestamp)
    const withdrawalLeaf = poseidon([depositNullifier, withdrawalTimestamp]);
    console.log("withdrawalLeaf: ", withdrawalLeaf)
    await withdrawalTree.insert(withdrawalLeaf)
  })
})
