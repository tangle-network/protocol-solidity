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
const { babyjub, poseidon, eddsa } = require('circomlibjs');

const blocks = ['0xaaaaaaaa', '0xbbbbbbbb', '0xcccccccc', '0xdddddddd'];

describe('swap snarkjs local proof', () => {
  let sender: SignerWithAddress;
  let zkComponent: ZkComponents;
  let create2InputWitness;
  let chainID = BigNumber.from(31337);

  before('should zk components', async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;

    zkComponent = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, '../../solidity-fixtures/solidity-fixtures/swap_2/30/swap_30_2.wasm'),
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/swap_2/30/witness_calculator.cjs'
      ),
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/swap_2/30/circuit_final.zkey'
      )
    );

    create2InputWitness = async (data: any) => {
      const witnessCalculator = require('../../solidity-fixtures/solidity-fixtures/swap_2/30/witness_calculator.cjs');
      const fileBuf = require('fs').readFileSync(
        'solidity-fixtures/solidity-fixtures/swap_2/30/swap_30_2.wasm'
      );
      const wtnsCalc = await witnessCalculator(fileBuf);

      const wtns = await wtnsCalc.calculateWTNSBin(data, 0);
      return wtns;
    };
  });

  it('should work', async () => {
    const webbETHAssetID = 1;
    const webbETHTokenID = 0;
    const webbBTCAssetID = 2;
    const webbBTCTokenID = 0;

    const aliceKey = new MaspKey();
    const bobKey = new MaspKey();

    const aliceSpendRecord = new MaspUtxo(
      chainID,
      aliceKey,
      BigNumber.from(webbETHAssetID),
      BigNumber.from(webbETHTokenID),
      BigNumber.from(2e7)
    );
    const aliceChangeRecord = new MaspUtxo(
      chainID,
      aliceKey,
      BigNumber.from(webbETHAssetID),
      BigNumber.from(webbETHTokenID),
      BigNumber.from(1e7)
    );
    const aliceReceiveRecord = new MaspUtxo(
      chainID,
      aliceKey,
      BigNumber.from(webbBTCAssetID),
      BigNumber.from(webbBTCTokenID),
      BigNumber.from(1e6)
    );

    const bobSpendRecord = new MaspUtxo(
      chainID,
      bobKey,
      BigNumber.from(webbBTCAssetID),
      BigNumber.from(webbBTCTokenID),
      BigNumber.from(2e6)
    );
    const bobChangeRecord = new MaspUtxo(
      chainID,
      bobKey,
      BigNumber.from(webbBTCAssetID),
      BigNumber.from(webbBTCTokenID),
      BigNumber.from(1e6)
    );
    const bobReceiveRecord = new MaspUtxo(
      chainID,
      bobKey,
      BigNumber.from(webbETHAssetID),
      BigNumber.from(webbETHTokenID),
      BigNumber.from(1e7)
    );

    const levels = 30;

    const maspMerkleTree = new MerkleTree(levels);

    maspMerkleTree.insert(aliceSpendRecord.getCommitment());
    maspMerkleTree.insert(bobSpendRecord.getCommitment());
    assert.strictEqual(maspMerkleTree.number_of_elements(), 2);
    const alicePath = maspMerkleTree.path(0);
    const aliceSpendPathElements = alicePath.pathElements.map((bignum: BigNumber) =>
      bignum.toString()
    );
    const aliceSpendPathIndices = MerkleTree.calculateIndexFromPathIndices(alicePath.pathIndices);
    aliceSpendRecord.forceSetIndex(BigNumber.from(0));

    const bobPath = maspMerkleTree.path(1);
    const bobSpendPathElements = bobPath.pathElements.map((bignum: BigNumber) => bignum.toString());
    const bobSpendPathIndices = MerkleTree.calculateIndexFromPathIndices(bobPath.pathIndices);
    bobSpendRecord.forceSetIndex(BigNumber.from(1));

    let t = new Date();
    let currentTimestamp = new Date();
    let tPrime = new Date();

    currentTimestamp.setMonth(3);
    tPrime.setMonth(5);

    const swapMessageHash = poseidon([
      aliceChangeRecord.getCommitment(),
      aliceReceiveRecord.getCommitment(),
      bobChangeRecord.getCommitment(),
      bobReceiveRecord.getCommitment(),
      t.getTime(),
      tPrime.getTime(),
    ]);

    const aliceSig = eddsa.signPoseidon(aliceKey.sk, swapMessageHash);
    const bobSig = eddsa.signPoseidon(bobKey.sk, swapMessageHash);

    const circuitInput = {
      aliceSpendAssetID: aliceSpendRecord.assetID,
      aliceSpendTokenID: aliceSpendRecord.tokenID,
      aliceSpendAmount: aliceSpendRecord.amount,
      aliceSpendInnerPartialRecord: aliceSpendRecord.getInnerPartialCommitment(),
      bobSpendAssetID: bobSpendRecord.assetID,
      bobSpendTokenID: bobSpendRecord.tokenID,
      bobSpendAmount: bobSpendRecord.amount,
      bobSpendInnerPartialRecord: bobSpendRecord.getInnerPartialCommitment(),
      t: t.getTime(),
      tPrime: tPrime.getTime(),

      alice_ak_X: aliceKey.ak[0],
      alice_ak_Y: aliceKey.ak[1],

      bob_ak_X: bobKey.ak[0],
      bob_ak_Y: bobKey.ak[1],

      alice_R8x: aliceSig.R8[0],
      alice_R8y: aliceSig.R8[1],

      aliceSig: aliceSig.S,

      bob_R8x: bobSig.R8[0],
      bob_R8y: bobSig.R8[1],

      bobSig: bobSig.S,

      aliceSpendPathElements: aliceSpendPathElements,
      aliceSpendPathIndices: aliceSpendPathIndices,
      aliceSpendNullifier: aliceSpendRecord.getNullifier(),

      bobSpendPathElements: bobSpendPathElements,
      bobSpendPathIndices: bobSpendPathIndices,
      bobSpendNullifier: bobSpendRecord.getNullifier(),

      swapChainID: chainID,
      roots: [maspMerkleTree.root(), randomBN(32)],
      currentTimestamp: currentTimestamp.getTime(),

      aliceChangeChainID: aliceChangeRecord.chainID,
      aliceChangeAssetID: aliceChangeRecord.assetID,
      aliceChangeTokenID: aliceChangeRecord.tokenID,
      aliceChangeAmount: aliceChangeRecord.amount,
      aliceChangeInnerPartialRecord: aliceChangeRecord.getInnerPartialCommitment(),
      aliceChangeRecord: aliceChangeRecord.getCommitment(),
      bobChangeChainID: bobChangeRecord.chainID,
      bobChangeAssetID: bobChangeRecord.assetID,
      bobChangeTokenID: bobChangeRecord.tokenID,
      bobChangeAmount: bobChangeRecord.amount,
      bobChangeInnerPartialRecord: bobChangeRecord.getInnerPartialCommitment(),
      bobChangeRecord: bobChangeRecord.getCommitment(),

      aliceReceiveChainID: aliceReceiveRecord.chainID,
      aliceReceiveAssetID: aliceReceiveRecord.assetID,
      aliceReceiveTokenID: aliceReceiveRecord.tokenID,
      aliceReceiveAmount: aliceReceiveRecord.amount,
      aliceReceiveInnerPartialRecord: aliceReceiveRecord.getInnerPartialCommitment(),
      aliceReceiveRecord: aliceReceiveRecord.getCommitment(),
      bobReceiveChainID: bobReceiveRecord.chainID,
      bobReceiveAssetID: bobReceiveRecord.assetID,
      bobReceiveTokenID: bobReceiveRecord.tokenID,
      bobReceiveAmount: bobReceiveRecord.amount,
      bobReceiveInnerPartialRecord: bobReceiveRecord.getInnerPartialCommitment(),
      bobReceiveRecord: bobReceiveRecord.getCommitment(),
    };

    const wtns = await create2InputWitness(circuitInput);
    let res = await snarkjs.groth16.prove(
      'solidity-fixtures/solidity-fixtures/swap_2/30/circuit_final.zkey',
      wtns
    );
    const proof = res.proof;
    let publicSignals = res.publicSignals;
    const vKey = await snarkjs.zKey.exportVerificationKey(
      'solidity-fixtures/solidity-fixtures/swap_2/30/circuit_final.zkey'
    );

    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    assert.strictEqual(res, true);
  });
});
