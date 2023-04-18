/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

const assert = require('assert');
import {
  Keypair,
  generateVariableWitnessInput,
  getVAnchorExtDataHash,
  CircomUtxo,
  MerkleTree,
  toFixedHex,
  toBuffer,
  randomBN,
} from '@webb-tools/sdk-core';
import { PoseidonHasher, VAnchor } from '@webb-tools/anchors';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { poseidon } from 'circomlibjs';
import {
  getChainIdType,
  hexToU8a,
  u8aToHex,
  ZkComponents,
  fetchComponentsFromFilePaths,
} from '@webb-tools/utils';
import { Verifier } from '@webb-tools/vbridge';
import {
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  FungibleTokenWrapper as WrappedToken,
  FungibleTokenWrapper__factory as WrappedTokenFactory,
} from '@webb-tools/contracts';
import { MaspKey, MaspUtxo } from '@webb-tools/utils';
const snarkjs = require('snarkjs');
const path = require('path');

const blocks = ['0xaaaaaaaa', '0xbbbbbbbb', '0xcccccccc', '0xdddddddd'];

describe('Reward snarkjs local proof', () => {
  let unspentTree: MerkleTree;
  let spentTree: MerkleTree;
  // VAnchor-like contract's merkle-tree
  let maspMerkleTree: MerkleTree;
  // VAnchor-like contract's merkle-tree for the AP tokens
  let rewardMerkleTree: MerkleTree;
  let token: ERC20PresetMinterPauser;
  let sender: SignerWithAddress;
  let wrappedToken: WrappedToken;
  let zkComponent: ZkComponents;
  let emptyTreeRoot: BigNumber;
  let create2InputWitness;

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
    maspMerkleTree = new MerkleTree(levels);
    rewardMerkleTree = new MerkleTree(levels);
    emptyTreeRoot = maspMerkleTree.root();

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

    create2InputWitness = async (data: any) => {
      const witnessCalculator = require('../../solidity-fixtures/solidity-fixtures/reward_2/30/witness_calculator.cjs');
      const fileBuf = require('fs').readFileSync(
        'solidity-fixtures/solidity-fixtures/reward_2/30/reward_30_2.wasm'
      );
      const wtnsCalc = await witnessCalculator(fileBuf);

      const wtns = await wtnsCalc.calculateWTNSBin(data, 0);
      return wtns;
    };
  });

  it('should work', async () => {
    // Create MASP Key
    const maspKey = new MaspKey();

    const assetID = 1;
    const tokenID = 0;

    // Create MASP Utxo
    const maspAmount = BigNumber.from(1e7);
    const maspUtxo = new MaspUtxo(
      BigNumber.from(chainID),
      maspKey,
      BigNumber.from(assetID),
      BigNumber.from(tokenID),
      maspAmount
    );

    // create deposit UTXO
    const maspCommitment = maspUtxo.getCommitment();
    await maspMerkleTree.insert(maspCommitment);
    assert.strictEqual(maspMerkleTree.number_of_elements(), 1);
    const maspPath = maspMerkleTree.path(0);
    const maspPathElements = maspPath.pathElements.map((bignum: BigNumber) => bignum.toString());
    const maspPathIndices = MerkleTree.calculateIndexFromPathIndices(maspPath.pathIndices);
    maspUtxo.setIndex(BigNumber.from(0));

    // Update depositTree with vanchor UTXO commitment
    const unspentTimestamp = Date.now();
    const unspentLeaf = poseidon([maspCommitment, unspentTimestamp]);
    await unspentTree.insert(unspentLeaf);
    assert.strictEqual(unspentTree.number_of_elements(), 1);

    const spentTimestamp = Date.now() + 1000;

    const maspNullifier = maspUtxo.getNullifier();
    const spentLeaf = poseidon([maspNullifier, spentTimestamp]);
    await spentTree.insert(spentLeaf);
    assert.strictEqual(spentTree.number_of_elements(), 1);

    const rate = 1000;
    const fee = 0;

    // empty/dummy input AP-VAnchor UTXO
    const inputAmount = 0;
    const rewardInputUtxo = await generateUTXOForTest(chainID, inputAmount);
    const inputPrivateKey = rewardInputUtxo.getKeypair().privkey;
    const inputRoot = rewardMerkleTree.root().toString();
    const inputPathElements = new Array(rewardMerkleTree.levels).fill(0);
    const inputPathIndices = MerkleTree.calculateIndexFromPathIndices(
      new Array(rewardMerkleTree.levels).fill(0)
    );

    const outputAmount = rate * (spentTimestamp - unspentTimestamp) * maspAmount.toNumber();
    const rewardOutputUtxo = await generateUTXOForTest(chainID, outputAmount);
    const outputCommitment = toFixedHex(rewardOutputUtxo.commitment);
    const outputPrivateKey = rewardOutputUtxo.getKeypair().privkey;
    const unspentRoots = [unspentTree.root().toString(), emptyTreeRoot.toString()];
    const unspentPath = unspentTree.path(0);
    const unspentPathElements = unspentPath.pathElements.map((bignum: BigNumber) =>
      bignum.toString()
    );
    const unspentPathIndices = MerkleTree.calculateIndexFromPathIndices(unspentPath.pathIndices);

    assert.strictEqual(spentTree.number_of_elements(), 1);
    const spentRoots = [spentTree.root().toString(), emptyTreeRoot.toString()];
    const spentPath = spentTree.path(0);
    const spentPathElements = spentPath.pathElements.map((bignum: BigNumber) => bignum.toString());
    const spentPathIndices = MerkleTree.calculateIndexFromPathIndices(spentPath.pathIndices);

    const rewardNullifier = poseidon([maspNullifier, maspPathIndices]);

    const circuitInput = {
      rate: rate,
      fee: fee,
      rewardNullifier: rewardNullifier,
      // Dummy
      extDataHash: randomBN(31).toHexString(),

      // MASP Spent Note for which anonymity points are being claimed
      noteChainID: chainID,
      noteAmount: maspAmount,
      noteAssetID: assetID,
      noteTokenID: tokenID,
      note_ak_X: maspKey.getProofAuthorizingKey()[0],
      note_ak_Y: maspKey.getProofAuthorizingKey()[1],
      noteBlinding: maspUtxo.blinding,
      notePathElements: maspPathElements,
      notePathIndices: maspPathIndices,

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
    };

    const wtns = await create2InputWitness(circuitInput);
    let res = await snarkjs.groth16.prove(
      'solidity-fixtures/solidity-fixtures/reward_2/30/circuit_final.zkey',
      wtns
    );
    const proof = res.proof;
    let publicSignals = res.publicSignals;
    const vKey = await snarkjs.zKey.exportVerificationKey(
      'solidity-fixtures/solidity-fixtures/reward_2/30/circuit_final.zkey'
    );

    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    assert.strictEqual(res, true);
  });
});
