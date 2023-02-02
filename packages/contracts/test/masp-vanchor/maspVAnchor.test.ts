/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { ethers } from 'hardhat';
const TruffleAssert = require('truffle-assertions');

// Typechain generated bindings for contracts
// These contracts are included in packages, so should be tested
import {
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  ERC721Mintable,
  ERC721Mintable__factory,
  FungibleTokenWrapper as WrappedToken,
  FungibleTokenWrapper__factory as WrappedTokenFactory,
  NftTokenWrapper as WrappedNftToken,
  NftTokenWrapper__factory as WrappedNftTokenFactory,
} from '@webb-tools/contracts';

import { BigNumber } from 'ethers';

import {
  hexToU8a,
  fetchComponentsFromFilePaths,
  getChainIdType,
  ZkComponents,
  u8aToHex,
  ZERO_BYTES32,
  MaspUtxo,
  MaspKey,
} from '@webb-tools/utils';

import { MultiAssetVAnchor, PoseidonHasher } from '@webb-tools/anchors';

import { MultiAssetVerifier } from '@webb-tools/vbridge';
import { writeFileSync } from 'fs';
import { Registry } from '@webb-tools/tokens';

const BN = require('bn.js');
const path = require('path');
const { poseidon } = require('circomlibjs');
const snarkjs = require('snarkjs');
const { toBN } = require('web3-utils');
const { babyjub } = require('circomlibjs');

describe('MASPVAnchor for 2 max edges', () => {
  let maspVAnchor: MultiAssetVAnchor;
  let zkComponents2_2: ZkComponents;
  let zkComponents16_2: ZkComponents;
  const levels = 30;
  let sender;
  const maxEdges = 1;
  let registry;
  let verifier;
  const chainID = getChainIdType(31337);
  let unwrappedERC20_1;
  let unwrappedERC20_2;
  let unwrappedERC20_3;
  let wrappedERC20;
  let unwrappedERC721_1;
  let unwrappedERC721_2;
  let unwrappedERC721_3;
  let wrappedERC721_1;
  let wrappedERC721_2;
  let wrappedERC721_3;
  let create2InputWitness;

  const masp_vanchor_2_2_wasm_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/masp_vanchor_2/2/masp_vanchor_2_2.wasm'
  );
  const masp_vanchor_2_2_witness_calc_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/masp_vanchor_2/2/witness_calculator.cjs'
  );
  const masp_vanchor_2_2_zkey_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/masp_vanchor_2/2/circuit_final.zkey'
  );

  const masp_vanchor_16_2_wasm_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/masp_vanchor_16/2/masp_vanchor_16_2.wasm'
  );
  const masp_vanchor_16_2_witness_calc_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/masp_vanchor_16/2/witness_calculator.cjs'
  );
  const masp_vanchor_16_2_zkey_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/masp_vanchor_16/2/circuit_final.zkey'
  );

  before('instantiate zkcomponents and user keypairs', async () => {
    zkComponents2_2 = await fetchComponentsFromFilePaths(
      masp_vanchor_2_2_wasm_path,
      masp_vanchor_2_2_witness_calc_path,
      masp_vanchor_2_2_zkey_path
    );

    zkComponents16_2 = await fetchComponentsFromFilePaths(
      masp_vanchor_16_2_wasm_path,
      masp_vanchor_16_2_witness_calc_path,
      masp_vanchor_16_2_zkey_path
    );

    create2InputWitness = async (data: any) => {
      const witnessCalculator = require('../../solidity-fixtures/solidity-fixtures/masp_vanchor_2/2/witness_calculator.cjs');
      const fileBuf = require('fs').readFileSync(
        'solidity-fixtures/solidity-fixtures/masp_vanchor_2/2/masp_vanchor_2_2.wasm'
      );
      const wtnsCalc = await witnessCalculator(fileBuf);

      const wtns = await wtnsCalc.calculateWTNSBin(data, 0);
      return wtns;
    };
  });

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);
    registry = await Registry.createRegistry(sender);
    verifier = await MultiAssetVerifier.createVerifier(sender);
    maspVAnchor = await MultiAssetVAnchor.createMASPVAnchor(
      registry.contract.address,
      verifier.contract.address,
      levels,
      hasherInstance.contract.address,
      sender.address,
      maxEdges,
      zkComponents2_2,
      zkComponents16_2,
      sender
    );
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      const actualMaxEdges = await maspVAnchor.contract.maxEdges();
      assert.strictEqual(actualMaxEdges.toString(), `${maxEdges}`);
    });
  });

  describe('masp snark proof native verification on js side', () => {
    it.only('should work', async () => {
      const extAmount = 1e7;
      const relayer = '0x2111111111111111111111111111111111111111';
      const recipient = '0x1111111111111111111111111111111111111111';
      const roots = await maspVAnchor.populateRootsForProof();
      const assetID = 1;
      const tokenID = 0;
      const feeAssetID = 2;
      const feeTokenID = 0;
      const maspKey = new MaspKey();
      const inputs = [
        new MaspUtxo(
          BigNumber.from(chainID),
          maspKey,
          BigNumber.from(assetID),
          BigNumber.from(tokenID),
          BigNumber.from(0)
        ),
        new MaspUtxo(
          BigNumber.from(chainID),
          maspKey,
          BigNumber.from(assetID),
          BigNumber.from(tokenID),
          BigNumber.from(0)
        ),
      ];
      const outputs = [
        new MaspUtxo(
          BigNumber.from(chainID),
          maspKey,
          BigNumber.from(assetID),
          BigNumber.from(tokenID),
          BigNumber.from(1e7)
        ),
        new MaspUtxo(
          BigNumber.from(chainID),
          maspKey,
          BigNumber.from(assetID),
          BigNumber.from(tokenID),
          BigNumber.from(0)
        ),
      ];
      const randomize_maspKey_1 = maspKey.randomize_sk_ak();
      const randomize_maspKey_2 = maspKey.randomize_sk_ak();
      const alphas = [randomize_maspKey_1.alpha.toString(), randomize_maspKey_2.alpha.toString()];
      const feeMaspKey = new MaspKey();
      const feeInputs = [
        new MaspUtxo(
          BigNumber.from(chainID),
          feeMaspKey,
          BigNumber.from(feeAssetID),
          BigNumber.from(feeTokenID),
          BigNumber.from(0)
        ),
        new MaspUtxo(
          BigNumber.from(chainID),
          feeMaspKey,
          BigNumber.from(feeAssetID),
          BigNumber.from(feeTokenID),
          BigNumber.from(0)
        ),
      ];
      const feeOutputs = [
        new MaspUtxo(
          BigNumber.from(chainID),
          feeMaspKey,
          BigNumber.from(feeAssetID),
          BigNumber.from(feeTokenID),
          BigNumber.from(5e6)
        ),
        new MaspUtxo(
          BigNumber.from(chainID),
          feeMaspKey,
          BigNumber.from(feeAssetID),
          BigNumber.from(feeTokenID),
          BigNumber.from(0)
        ),
      ];
      const randomize_feeMaspKey_1 = feeMaspKey.randomize_sk_ak();
      const randomize_feeMaspKey_2 = feeMaspKey.randomize_sk_ak();
      const fee_alphas = [
        randomize_feeMaspKey_1.alpha.toString(),
        randomize_feeMaspKey_2.alpha.toString(),
      ];
      const fee = 0;
      const whitelistedAssetIDs = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
      inputs.map((x) => x.setIndex(BigNumber.from(0)));
      feeInputs.map((x) => x.setIndex(BigNumber.from(0)));
      // Dummy set index
      inputs.map((x) => x.setIndex(BigNumber.from(0)));
      inputs.map((x) => x.setIndex(BigNumber.from(0)));

      const merkleProofsForInputs = inputs.map((x) => maspVAnchor.getMASPMerkleProof(x));
      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      const feeMerkleProofsForInputs = feeInputs.map((x) => maspVAnchor.getMASPMerkleProof(x));
      const feeEncOutput1 = feeOutputs[0].encrypt();
      const feeEncOutput2 = feeOutputs[1].encrypt();

      const { extData, extDataHash } = await maspVAnchor.generateExtData(
        recipient,
        BigNumber.from(extAmount),
        relayer,
        BigNumber.from(0),
        BigNumber.from(0),
        '0',
        encOutput1,
        encOutput2
      );

      const { allInputs, publicInputs } = await MultiAssetVAnchor.generateMASPVAnchorInputs(
        roots,
        chainID,
        assetID,
        tokenID,
        inputs,
        outputs,
        alphas,
        feeAssetID,
        feeTokenID,
        whitelistedAssetIDs,
        feeInputs,
        feeOutputs,
        fee_alphas,
        BigNumber.from(extAmount),
        BigNumber.from(0),
        extDataHash,
        merkleProofsForInputs,
        feeMerkleProofsForInputs
      );

      const wtns = await create2InputWitness(allInputs);
      let res = await snarkjs.groth16.prove(
        'solidity-fixtures/solidity-fixtures/masp_vanchor_2/2/circuit_final.zkey',
        wtns
      );
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey(
        'solidity-fixtures/solidity-fixtures/masp_vanchor_2/2/circuit_final.zkey'
      );

      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, true);
    });
  });
});
