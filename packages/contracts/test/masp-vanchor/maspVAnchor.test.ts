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
} from '@webb-tools/utils';

import { MultiAssetVAnchor, PoseidonHasher } from '@webb-tools/anchors';

import { MultiAssetVerifier } from '@webb-tools/vbridge';
import { writeFileSync } from 'fs';
import { Registry } from '@webb-tools/tokens';
import { MASPVAnchorVerifier } from 'packages/contracts/lib';

const BN = require('bn.js');
const path = require('path');
const { poseidon } = require('circomlibjs');
const snarkjs = require('snarkjs');
const { toBN } = require('web3-utils');

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
      maspVAnchor = await MultiAssetVAnchor.createMASPVAnchor(registry.contract.address, verifier.contract.address, levels, hasherInstance.contract.address, sender.address, maxEdges, zkComponents2_2, zkComponents16_2, sender);

      // Instantiate all the tokens
      const unwrappedERC20Factory_1 = new ERC20PresetMinterPauser__factory(wallet);
      const unwrappedERC20Factory_2 = new ERC20PresetMinterPauser__factory(wallet);
      const unwrappedERC20Factory_3 = new ERC20PresetMinterPauser__factory(wallet);

      unwrappedERC20_1 = await unwrappedERC20Factory_1.deploy('test fungible token 1', 'TEST_FUNGIBLE_1');
      await unwrappedERC20_1.deployed();

      unwrappedERC20_2 = await unwrappedERC20Factory_2.deploy('test fungible token 2', 'TEST_FUNGIBLE_2');
      await unwrappedERC20_2.deployed();

      unwrappedERC20_3 = await unwrappedERC20Factory_3.deploy('test fungible token 3', 'TEST_FUNGIBLE_3');
      await unwrappedERC20_3.deployed();

      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedERC20 = await wrappedTokenFactory.deploy(name, symbol);
      await wrappedERC20.deployed();
      await wrappedERC20.initialize(
        0,
        dummyFeeRecipient,
        sender.address,
        '10000000000000000000000000',
        true
      );
      await wrappedERC20.add(unwrappedERC20_1.address, (await wrappedERC20.proposalNonce()).add(1));
      await wrappedERC20.add(unwrappedERC20_2.address, (await wrappedERC20.proposalNonce()).add(1));
      await wrappedERC20.add(unwrappedERC20_3.address, (await wrappedERC20.proposalNonce()).add(1));

      const unwrappedERC721Factory_1 = new ERC721Mintable__factory(wallet);
      const unwrappedERC721Factory_2 = new ERC721Mintable__factory(wallet);
      const unwrappedERC721Factory_3 = new ERC721Mintable__factory(wallet);

      unwrappedERC721_1 = await unwrappedERC721Factory_1.deploy('test NFT token 1', 'TEST_NFT_1');
      await unwrappedERC721_1.deployed();
      unwrappedERC721_2 = await unwrappedERC721Factory_2.deploy('test NFT token 2', 'TEST_NFT_2');
      await unwrappedERC721_2.deployed();
      unwrappedERC721_3 = await unwrappedERC721Factory_3.deploy('test NFT token 3', 'TEST_NFT_3');
      await unwrappedERC721_3.deployed();

      const uri_1 = "hi1";
      const uri_2 = "hi2";
      const uri_3 = "hi3";

      const wrappedNftTokenFactory_1 = new WrappedNftTokenFactory(wallet);
      wrappedERC721_1 =  await wrappedNftTokenFactory_1.deploy(uri_1);
      await wrappedERC721_1.deployed();
      await wrappedERC721_1.initialize(sender.address);

      const wrappedNftTokenFactory_2 = new WrappedNftTokenFactory(wallet);
      wrappedERC721_2 =  await wrappedNftTokenFactory_2.deploy(uri_2);
      await wrappedERC721_2.deployed();
      await wrappedERC721_2.initialize(sender.address);

      const wrappedNftTokenFactory_3 = new WrappedNftTokenFactory(wallet);
      wrappedERC721_3 =  await wrappedNftTokenFactory_3.deploy(uri_3);
      await wrappedERC721_3.deployed();
      await wrappedERC721_3.initialize(sender.address);
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
        const aliceDepositAmount = 1e7;
        const roots = await maspVAnchor.populateRootsForProof();
        const inputs = [new MaspUtxo(BigNumber.from(chainID), BigNumber.from(1), BigNumber.from(0), BigNumber.from(0)), new MaspUtxo(BigNumber.from(chainID), BigNumber.from(1), BigNumber.from(0), BigNumber.from(0))];
        const outputs = [
          new MaspUtxo(BigNumber.from(chainID), BigNumber.from(1), BigNumber.from(0), BigNumber.from(aliceDepositAmount)),
          new MaspUtxo(BigNumber.from(chainID), BigNumber.from(1), BigNumber.from(0), BigNumber.from(0)),
        ];

        // Dummy set index
        inputs.map((x) => x.setIndex(BigNumber.from(0)));

        const merkleProofsForInputs = inputs.map((x) => maspVAnchor.getMASPMerkleProof(x));
        const encOutput1 = outputs[0].encrypt();
        const encOutput2 = outputs[1].encrypt();
  
        const {extData, extDataHash } = await maspVAnchor.generateExtData ( 
          recipient,
          BigNumber.from(extAmount),
          relayer,
          BigNumber.from(0),
          BigNumber.from(0),
          '0',
          encOutput1,
          encOutput2,
        );
  
        const { allInputs, publicInputs } = await MultiAssetVAnchor.generateMASPVAnchorInputs(
          roots,
          chainID,
          1,
          0,
          inputs,
          outputs,
          BigNumber.from(extAmount),
          BigNumber.from(0),
          extDataHash,
          merkleProofsForInputs,
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


