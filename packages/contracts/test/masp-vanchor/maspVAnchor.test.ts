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

import {
  MultiAssetVAnchorProxy,
  MultiAssetVAnchorBatchTree,
  PoseidonHasher,
  BatchTreeVerifier,
  SwapProofVerifier,
} from '@webb-tools/anchors';

import { MultiAssetVerifier } from '@webb-tools/vbridge';
import { writeFileSync } from 'fs';
import {
  Registry,
  RegistryHandler,
  MultiFungibleTokenManager,
  MultiNftTokenManager,
  NftTokenWrapper,
  ERC20,
  ERC721,
  TokenWrapperHandler,
  FungibleTokenWrapper,
} from '@webb-tools/tokens';
import { randomBytes } from 'ethers/lib/utils';
import { toFixedHex } from '@webb-tools/sdk-core';

const BN = require('bn.js');
const path = require('path');
const { poseidon } = require('circomlibjs');
const snarkjs = require('snarkjs');
const { toBN } = require('web3-utils');
const { babyjub } = require('circomlibjs');

describe('MASPVAnchor for 2 max edges', () => {
  let maspVAnchor: MultiAssetVAnchorBatchTree;
  let zkComponents2_2: ZkComponents;
  let zkComponents16_2: ZkComponents;
  let swapCircuitZkComponents: ZkComponents;
  let batchTreeZkComponents_4: ZkComponents;
  let batchTreeZkComponents_8: ZkComponents;
  let batchTreeZkComponents_16: ZkComponents;
  let batchTreeZkComponents_32: ZkComponents;
  const levels = 20;
  let sender;
  const maxEdges = 1;
  let registry;
  let registryHandler;
  let maspProxy;
  let dummyBridgeSigner;
  let multiFungibleTokenManager;
  let multiNftTokenManager;
  let masterFeeRecipient;
  let transactionVerifier;
  let swapVerifier;
  let batchVerifier;
  let dummyAnchorHandlerAddress;
  const chainID = getChainIdType(31337);
  let unwrappedERC20_1;
  let unwrappedERC20_2;
  let unwrappedERC20_3;
  let unwrappedERC721_1;
  let unwrappedERC721_2;
  let unwrappedERC721_3;
  let fungibleWebbToken;
  let nftWebbToken;
  let create2InputWitness;
  let signers;

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

  const swap_2_wasm_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/swap_2/30/swap_30_2.wasm'
  );

  const swap_2_witness_calc_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/swap_2/30/witness_calculator.cjs'
  );

  const swap_2_zkey_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/swap_2/30/circuit_final.zkey'
  );

  const batchTree_4_wasm_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/4/batchMerkleTreeUpdate_4.wasm'
  );

  const batchTree_4_witness_calc_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/4/witness_calculator.cjs'
  );

  const batchTree_4_zkey_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/4/circuit_final.zkey'
  );

  const batchTree_8_wasm_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/8/batchMerkleTreeUpdate_8.wasm'
  );

  const batchTree_8_witness_calc_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/8/witness_calculator.cjs'
  );

  const batchTree_8_zkey_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/8/circuit_final.zkey'
  );

  const batchTree_16_wasm_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/16/batchMerkleTreeUpdate_16.wasm'
  );

  const batchTree_16_witness_calc_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/16/witness_calculator.cjs'
  );

  const batchTree_16_zkey_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/16/circuit_final.zkey'
  );

  const batchTree_32_wasm_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/32/batchMerkleTreeUpdate_32.wasm'
  );

  const batchTree_32_witness_calc_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/32/witness_calculator.cjs'
  );

  const batchTree_32_zkey_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/32/circuit_final.zkey'
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

    swapCircuitZkComponents = await fetchComponentsFromFilePaths(
      swap_2_wasm_path,
      swap_2_witness_calc_path,
      swap_2_zkey_path
    );

    batchTreeZkComponents_4 = await fetchComponentsFromFilePaths(
      batchTree_4_wasm_path,
      batchTree_4_witness_calc_path,
      batchTree_4_zkey_path
    );

    batchTreeZkComponents_8 = await fetchComponentsFromFilePaths(
      batchTree_8_wasm_path,
      batchTree_8_witness_calc_path,
      batchTree_8_zkey_path
    );

    batchTreeZkComponents_16 = await fetchComponentsFromFilePaths(
      batchTree_16_wasm_path,
      batchTree_16_witness_calc_path,
      batchTree_16_zkey_path
    );

    batchTreeZkComponents_32 = await fetchComponentsFromFilePaths(
      batchTree_32_wasm_path,
      batchTree_32_witness_calc_path,
      batchTree_32_zkey_path
    );

    create2InputWitness = async (data: any) => {
      const wtns = await zkComponents2_2.witnessCalculator.calculateWTNSBin(data, 0);
      return wtns;
    };
  });

  beforeEach(async () => {
    signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    dummyBridgeSigner = signers[1];
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);
    registry = await Registry.createRegistry(sender);
    registryHandler = await RegistryHandler.createRegistryHandler(
      await dummyBridgeSigner.getAddress(),
      [await registry.createResourceId()],
      [registry.contract.address],
      dummyBridgeSigner
    );
    multiFungibleTokenManager = await MultiFungibleTokenManager.createMultiFungibleTokenManager(
      sender
    );
    multiNftTokenManager = await MultiNftTokenManager.createMultiNftTokenManager(sender);
    masterFeeRecipient = await signers[2].getAddress();
    transactionVerifier = await MultiAssetVerifier.createVerifier(sender);
    maspProxy = await MultiAssetVAnchorProxy.createMultiAssetVAnchorProxy(
      hasherInstance.contract.address,
      sender
    );
    swapVerifier = await SwapProofVerifier.createVerifier(sender);
    batchVerifier = await BatchTreeVerifier.createVerifier(sender);
    dummyAnchorHandlerAddress = await signers[3].getAddress();
    maspVAnchor = await MultiAssetVAnchorBatchTree.createMultiAssetVAnchorBatchTree(
      registry.contract.address,
      transactionVerifier.contract.address,
      batchVerifier.contract.address,
      swapVerifier.contract.address,
      dummyAnchorHandlerAddress,
      hasherInstance.contract.address,
      maspProxy.contract.address,
      levels,
      maxEdges,
      zkComponents2_2,
      zkComponents16_2,
      swapCircuitZkComponents,
      batchTreeZkComponents_4,
      batchTreeZkComponents_8,
      batchTreeZkComponents_16,
      batchTreeZkComponents_32,
      sender
    );
    // Initialize Registry
    await registry.initialize(
      multiFungibleTokenManager.contract.address,
      multiNftTokenManager.contract.address,
      registryHandler.contract.address,
      masterFeeRecipient,
      maspVAnchor.contract.address
    );
    // Initialize MASP Proxy
    await maspProxy.initialize([maspVAnchor.contract]);

    // Deploy a token handler
    const tokenHandler = await TokenWrapperHandler.createTokenWrapperHandler(
      await dummyBridgeSigner.getAddress(),
      [],
      [],
      dummyBridgeSigner
    );

    // Initialize Unwrapped ERC20 Tokens
    unwrappedERC20_1 = await ERC20.createERC20PresetMinterPauser(
      'ERC 20 Token 1',
      'ERC20-1',
      sender
    );
    const mintTx1 = await unwrappedERC20_1.contract.mint(sender.address, 1000000);
    await mintTx1.wait();
    unwrappedERC20_2 = await ERC20.createERC20PresetMinterPauser(
      'ERC 20 Token 2',
      'ERC20-2',
      sender
    );
    const mintTx2 = await unwrappedERC20_2.contract.mint(sender.address, 1000000);
    await mintTx2.wait();
    unwrappedERC20_3 = await ERC20.createERC20PresetMinterPauser(
      'ERC 20 Token 3',
      'ERC20-3',
      sender
    );
    const mintTx3 = await unwrappedERC20_3.contract.mint(sender.address, 1000000);
    await mintTx3.wait();

    // Register a wrapped fungible WEBB token
    const assetId = 1;
    const tokenName = '0x' + Buffer.from(ethers.utils.toUtf8Bytes('webb-fungible')).toString('hex');
    const tokenSymbol = '0x' + Buffer.from(ethers.utils.toUtf8Bytes('webbfung')).toString('hex');
    const salt = '0x' + Buffer.from(randomBytes(32)).toString('hex');
    const limit = '0x' + Buffer.from(randomBytes(32)).toString('hex');
    const feePercentage = 0;
    const isNativeAllowed = false;
    const proposalData = await registry.getRegisterFungibleTokenProposalData(
      tokenHandler.contract.address,
      assetId,
      tokenName,
      tokenSymbol,
      salt,
      limit,
      feePercentage,
      isNativeAllowed
    );
    // Call executeProposal function
    const registerFungibleTokenTx = await registryHandler.contract.executeProposal(
      await registry.createResourceId(),
      proposalData
    );
    await registerFungibleTokenTx.wait();

    fungibleWebbToken = await FungibleTokenWrapper.connect(
      await registry.contract.idToWrappedAsset(assetId),
      sender
    );

    // Set resource Id in token handler to fungible address
    const setResourceTx = await tokenHandler.contract.setResource(
      await fungibleWebbToken.createResourceId(),
      fungibleWebbToken.contract.address,
      {
        from: await dummyBridgeSigner.getAddress(),
      }
    );

    await setResourceTx.wait();

    // Add unwrapped ERC20 tokens to the wrapped fungible token
    const addTokenTx1 = await tokenHandler.contract.executeProposal(
      await fungibleWebbToken.createResourceId(),
      await fungibleWebbToken.getAddTokenProposalData(unwrappedERC20_1.contract.address)
    );
    await addTokenTx1.wait();

    const addTokenTx2 = await tokenHandler.contract.executeProposal(
      await fungibleWebbToken.createResourceId(),
      await fungibleWebbToken.getAddTokenProposalData(unwrappedERC20_2.contract.address)
    );
    await addTokenTx2.wait();

    const addTokenTx3 = await tokenHandler.contract.executeProposal(
      await fungibleWebbToken.createResourceId(),
      await fungibleWebbToken.getAddTokenProposalData(unwrappedERC20_3.contract.address)
    );
    await addTokenTx3.wait();

    // Initialize Unwrapped ERC721 Tokens
    unwrappedERC721_1 = await ERC721.createERC721('ERC721 Token 1', 'ERC721-1', sender);
    const mintTx4 = await unwrappedERC721_1.contract.mint(sender.address);
    await mintTx4.wait();
    const mintTx5 = await unwrappedERC721_1.contract.mint(sender.address);
    await mintTx5.wait();
    const mintTx6 = await unwrappedERC721_1.contract.mint(sender.address);
    await mintTx6.wait();
    const mintTx7 = await unwrappedERC721_1.contract.mint(sender.address);
    await mintTx7.wait();

    // Register a wrapped non-fungible WEBB token
    const webbNftAssetId = 2;
    const unwrappedNftAddr = await unwrappedERC721_1.contract.address;
    const webbNftSalt = '0x' + Buffer.from(randomBytes(32)).toString('hex');
    const webbNftName = '0x' + Buffer.from(randomBytes(32)).toString('hex');
    const webbNftSymbol = '0x' + Buffer.from(randomBytes(32)).toString('hex');
    const webbNftProposalData = await registry.getRegisterNftTokenProposalData(
      tokenHandler.contract.address,
      webbNftAssetId,
      unwrappedNftAddr,
      webbNftSalt,
      webbNftName,
      webbNftSymbol,
    );
    // Call executeProposal function
    const registerNftTokenTx = await registryHandler.contract.executeProposal(
      await registry.createResourceId(),
      webbNftProposalData
    );
    await registerNftTokenTx.wait();

    nftWebbToken = await NftTokenWrapper.connect(
      await registry.contract.idToWrappedAsset(webbNftAssetId),
      sender
    );
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      const actualMaxEdges = await maspVAnchor.contract.maxEdges();
      assert.strictEqual(actualMaxEdges.toString(), `${maxEdges}`);
    });
  });

  describe('note encryption decryption', () => {
    it('should decrypt correctly', async () => {
      const maspKey = new MaspKey();
      const assetID = 1;
      const tokenID = 0;
      const maspUtxo = new MaspUtxo(
        BigNumber.from(chainID),
        maspKey,
        BigNumber.from(assetID),
        BigNumber.from(tokenID),
        BigNumber.from(0)
      );
      const encryption = maspUtxo.encrypt(maspKey);
      const decryption = maspUtxo.decrypt(maspKey, maspUtxo.getCommitment(), encryption);
      assert.strictEqual(maspUtxo.assetID.toString(), decryption.assetID.toString());
      assert.strictEqual(maspUtxo.tokenID.toString(), decryption.tokenID.toString());
      assert.strictEqual(maspUtxo.amount.toString(), decryption.amount.toString());
      assert.strictEqual(maspUtxo.chainID.toString(), decryption.chainID.toString());
      assert.strictEqual(
        maspUtxo.maspKey.getPublicKey()[0].toString(),
        decryption.publicKey[0].toString()
      );
      assert.strictEqual(
        maspUtxo.maspKey.getPublicKey()[1].toString(),
        decryption.publicKey[1].toString()
      );
      assert.strictEqual(maspUtxo.blinding.toString(), decryption.blinding.toString());

      const wrongMaspKey = new MaspKey();
      const wrongDecryption = maspUtxo.decrypt(wrongMaspKey, maspUtxo.getCommitment(), encryption);
      assert.strictEqual(wrongDecryption, undefined);
    });
  });

  describe('masp snark proof native verification on js side', () => {
    it('should work', async () => {
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
      const fee = 0;
      const whitelistedAssetIDs = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
      inputs.map((x) => x.setIndex(BigNumber.from(0)));
      feeInputs.map((x) => x.setIndex(BigNumber.from(0)));
      // Dummy set index
      inputs.map((x) => x.setIndex(BigNumber.from(0)));
      feeInputs.map((x) => x.setIndex(BigNumber.from(0)));

      const merkleProofsForInputs = inputs.map((x) =>
        MultiAssetVAnchorBatchTree.getMASPMerkleProof(x, maspVAnchor.depositTree.tree)
      );
      const encOutput1 = '0x';
      const encOutput2 = '0x';

      const feeMerkleProofsForInputs = feeInputs.map((x) =>
        MultiAssetVAnchorBatchTree.getMASPMerkleProof(x, maspVAnchor.depositTree.tree)
      );
      const feeEncOutput1 = '0x';
      const feeEncOutput2 = '0x';

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

      const { allInputs, publicInputs } =
        await MultiAssetVAnchorBatchTree.generateMASPVAnchorInputs(
          roots,
          chainID,
          assetID,
          tokenID,
          inputs,
          outputs,
          inputs[0].maspKey,
          feeAssetID,
          feeTokenID,
          whitelistedAssetIDs,
          feeInputs,
          feeOutputs,
          feeInputs[0].maspKey,
          BigNumber.from(extAmount),
          BigNumber.from(0),
          extDataHash,
          merkleProofsForInputs,
          feeMerkleProofsForInputs
        );

      const wtns = await create2InputWitness(allInputs);
      let res = await snarkjs.groth16.prove(zkComponents2_2.zkey, wtns);

      const proof = res.proof;
      let publicSignals = res.publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey(zkComponents2_2.zkey);

      res = await snarkjs.groth16.verify(vKey, publicSignals, proof, console);
      assert.strictEqual(res, true);
    });
  });

  describe('asset registration smart contract tests', () => {
    it('registry handler should register fungible token', async () => {
      const dummyTokenHandler = '0x' + Buffer.from(randomBytes(20)).toString('hex');
      const dummyAssetId = 4;
      const dummyTokenName =
        '0x' + Buffer.from(ethers.utils.toUtf8Bytes('webb-ether')).toString('hex');
      const dummyTokenSymbol =
        '0x' + Buffer.from(ethers.utils.toUtf8Bytes('webbeth')).toString('hex');
      const dummySalt = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      const dummyLimit = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      const dummyFeePercentage = 10;
      const dummyIsNativeAllowed = true;
      const proposalData = await registry.getRegisterFungibleTokenProposalData(
        dummyTokenHandler,
        dummyAssetId,
        dummyTokenName,
        dummyTokenSymbol,
        dummySalt,
        dummyLimit,
        dummyFeePercentage,
        dummyIsNativeAllowed
      );
      // Call executeProposal function
      const registerFungibleTokenTx = await registryHandler.contract.executeProposal(
        await registry.createResourceId(),
        proposalData
      );
      await registerFungibleTokenTx.wait();
      // Check that fungible token is registered on the Registry contract
      const wrappedAssetAddr = await registry.contract.idToWrappedAsset(4);
      assert.strictEqual(
        (await registry.contract.wrappedAssetToId(wrappedAssetAddr)).toString(),
        dummyAssetId.toString()
      );
    });

    it('registry handler should register non-fungible token', async () => {
      const dummyTokenHandler = '0x' + Buffer.from(randomBytes(20)).toString('hex');
      const dummyAssetId = 5;
      const dummyUnwrappedNftAddr = '0x' + Buffer.from(randomBytes(20)).toString('hex');
      const dummySalt = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      const dummyName = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      const dummySymbol = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      const proposalData = await registry.getRegisterNftTokenProposalData(
        dummyTokenHandler,
        dummyAssetId,
        dummyUnwrappedNftAddr,
        dummySalt,
        dummyName,
        dummySymbol,
      );
      // Call executeProposal function
      const registerNftTokenTx = await registryHandler.contract.executeProposal(
        await registry.createResourceId(),
        proposalData
      );
      await registerNftTokenTx.wait();
      // Check that fungible token is registered on the Registry contract
      const wrappedAssetAddr = await registry.contract.idToWrappedAsset(5);
      assert.strictEqual(
        (await registry.contract.wrappedAssetToId(wrappedAssetAddr)).toString(),
        dummyAssetId.toString()
      );
    });
  });

  describe('masp smart contract deposit tests max edges = 1', () => {
    it('proxy should queue erc20 deposit', async () => {
      // Queue ERC20 deposit
      const tokenApproveTx = await unwrappedERC20_1.contract.approve(
        await maspProxy.contract.address,
        100
      );
      await tokenApproveTx.wait();
      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      // Check that deposit is queued
      const queuedDeposit = await maspProxy.getQueuedERC20Deposits(
        maspVAnchor.contract.address,
        BigNumber.from(0),
        BigNumber.from(1)
      );
      assert.strictEqual(queuedDeposit.length, 1);
      assert.strictEqual(queuedDeposit[0].unwrappedToken, unwrappedERC20_1.contract.address);
      assert.strictEqual(queuedDeposit[0].wrappedToken, fungibleWebbToken.contract.address);
      assert.strictEqual(queuedDeposit[0].amount.toString(), '100');
      assert.strictEqual(queuedDeposit[0].assetID.toString(), '1');
      assert.strictEqual(queuedDeposit[0].tokenID.toString(), '0');
      // Check that MASP proxy owns the ERC20 tokens
      assert.strictEqual(
        (await unwrappedERC20_1.contract.balanceOf(maspProxy.contract.address)).toString(),
        '100'
      );
    });

    it('proxy should NOT queue erc20 deposit for unregistered asset', async () => {
      await TruffleAssert.reverts(
        maspProxy.queueERC20Deposit(
          {
            unwrappedToken: unwrappedERC20_1.contract.address,
            wrappedToken: signers[3].address,
            amount: 100,
            assetID: 1,
            tokenID: 0,
            depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
            proxiedMASP: maspVAnchor.contract.address,
          },
          {
            from: sender.address,
          }
        ),
        'Wrapped asset not registered'
      );
    });

    it('proxy should queue erc721 deposit', async () => {
      await unwrappedERC721_1.approve(await maspProxy.contract.address, 1);
      await maspProxy.queueERC721Deposit(
        {
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 1,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      // Check that deposit is queued
      const queuedDeposit = await maspProxy.getQueuedERC721Deposits(
        maspVAnchor.contract.address,
        BigNumber.from(0),
        BigNumber.from(1)
      );
      assert.strictEqual(queuedDeposit.length, 1);
      assert.strictEqual(queuedDeposit[0].unwrappedToken, unwrappedERC721_1.contract.address);
      assert.strictEqual(queuedDeposit[0].wrappedToken, nftWebbToken.contract.address);
      assert.strictEqual(queuedDeposit[0].amount.toString(), '1');
      assert.strictEqual(queuedDeposit[0].assetID.toString(), '2');
      assert.strictEqual(queuedDeposit[0].tokenID.toString(), '1');
      // Check that MASP proxy owns the ERC721 tokens
      assert.strictEqual(
        (await unwrappedERC721_1.contract.balanceOf(maspProxy.contract.address)).toString(),
        '1'
      );
    });

    it('proxy should NOT queue erc721 deposit for unregistered asset', async () => {
      await TruffleAssert.reverts(
        maspProxy.queueERC721Deposit(
          {
            unwrappedToken: unwrappedERC721_1.contract.address,
            wrappedToken: signers[4].address,
            amount: 1,
            assetID: 2,
            tokenID: 1,
            depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
            proxiedMASP: maspVAnchor.contract.address,
          },
          {
            from: sender.address,
          }
        ),
        'Wrapped asset not registered'
      );
    });

    it('proxy should NOT queue deposit for masp it does not proxy for', async () => {
      await TruffleAssert.reverts(
        maspProxy.queueERC721Deposit(
          {
            unwrappedToken: unwrappedERC721_1.contract.address,
            wrappedToken: nftWebbToken.contract.address,
            amount: 1,
            assetID: 2,
            tokenID: 1,
            depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
            proxiedMASP: signers[5].address,
          },
          {
            from: sender.address,
          }
        ),
        'Invalid MASP'
      );
    });

    it('e2e should batch insert erc20 -> queue reward unspent tree -> transfer funds to masp -> batch insert on reward unspent tree', async () => {
      // Queue deposit
      await unwrappedERC20_1.contract.approve(await maspProxy.contract.address, 400);
      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      // Check MASP Proxy Balance of unwrapped ERC20
      assert.strictEqual(
        (await unwrappedERC20_1.contract.balanceOf(maspProxy.contract.address)).toString(),
        '400'
      );

      // Batch Insert
      await maspProxy.batchDepositERC20s(maspVAnchor, BigNumber.from(0), BigNumber.from(2));
    });
    it('e2e should batch insert erc20 -> queue reward unspent tree -> transfer funds to masp -> batch insert on reward unspent tree', async () => {
      // Queue deposit
      await unwrappedERC20_1.contract.approve(await maspProxy.contract.address, 400);
      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      // Check MASP Proxy Balance of unwrapped ERC20
      assert.strictEqual(
        (await unwrappedERC20_1.contract.balanceOf(maspProxy.contract.address)).toString(),
        '400'
      );

      // Batch Insert
      await maspProxy.batchDepositERC20s(maspVAnchor, BigNumber.from(0), BigNumber.from(2));

      // Check Reward Unspent Tree is Queued
      // Batch insert into reward unspent tree
    });

    it('e2e should batch insert erc721 -> queue reward unspent tree -> transfer funds to masp -> batch insert on reward unspent tree', async () => {
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 1);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 2);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 3);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 4);

      // Queue deposits
      await maspProxy.queueERC721Deposit(
        {
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 1,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      await maspProxy.queueERC721Deposit(
        {
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 2,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      await maspProxy.queueERC721Deposit(
        {
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 3,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      await maspProxy.queueERC721Deposit(
        {
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 4,
          depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      // Check MASP Proxy Balance of unwrapped ERC721
      assert.strictEqual(
        (await unwrappedERC721_1.contract.balanceOf(maspProxy.contract.address)).toString(),
        '4'
      );

      // Batch Insert
      await maspProxy.batchDepositERC721s(maspVAnchor, BigNumber.from(0), BigNumber.from(2));

      // Check Reward Unspent Tree is Queued
      // Batch insert into reward unspent tree
    });
  });

  describe('masp smart contract internal shielded transfer', () => {
    it('e2e should internal shielded transfer with valid transact proof -> reward tree commitments queued -> batch insert reward tree commitments', async () => {
      // 4 Masp Keys
      const alice_key = new MaspKey();
      const bob_key = new MaspKey();
      const carol_key = new MaspKey();
      const dave_key = new MaspKey();

      const webbFungibleAssetID = BigNumber.from(1);
      const webbFungibleTokenID = BigNumber.from(0);

      // 4 Masp Utxos
      const alice_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        alice_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );
      const alice_fee_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        alice_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(10)
      );
      const bob_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        carol_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );
      const carol_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        dave_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );

      // Queue deposit
      await unwrappedERC20_1.contract.approve(await maspProxy.contract.address, 400);
      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: toFixedHex(alice_utxo.getPartialCommitment()),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 10,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: toFixedHex(alice_fee_utxo.getPartialCommitment()),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: toFixedHex(bob_utxo.getPartialCommitment()),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: toFixedHex(carol_utxo.getPartialCommitment()),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      // Check MASP Proxy Balance of unwrapped ERC20
      assert.strictEqual(
        (await unwrappedERC20_1.contract.balanceOf(maspProxy.contract.address)).toString(),
        '310'
      );

      // Batch Insert
      await maspProxy.batchDepositERC20s(maspVAnchor, BigNumber.from(0), BigNumber.from(2));
      const queuedUtxos = [alice_utxo, alice_fee_utxo, bob_utxo, carol_utxo];
      const leaves = queuedUtxos.map((x) => x.getCommitment().toString());
      queuedUtxos.forEach((x) => {
        // Maintain tree state after insertions
        // maspVAnchor.depositTree.tree.insert(x.getCommitment());
        x.setIndex(
          BigNumber.from(maspVAnchor.depositTree.tree.indexOf(x.getCommitment().toString()))
        );
      });

      // Do internal shielded transfer
      const alice_utxo_2 = new MaspUtxo(
        BigNumber.from(chainID),
        alice_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(50)
      );

      const bob_utxo_2 = new MaspUtxo(
        BigNumber.from(chainID),
        bob_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(50)
      );

      const fee_output_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        carol_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(10)
      );

      await maspVAnchor.transact(
        webbFungibleAssetID,
        webbFungibleTokenID,
        [alice_utxo],
        [alice_utxo_2, bob_utxo_2],
        BigNumber.from(0),
        webbFungibleAssetID,
        webbFungibleTokenID,
        [alice_fee_utxo],
        [fee_output_utxo],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        BigNumber.from(0),
        sender.address,
        sender.address,
        sender
      );
    });
  });

  describe('masp smart contract withdraw ERC20', () => {
    it('e2e should withdraw ERC20 with valid transact proof -> reward tree commitments queued -> funds transferred -> batch insert reward tree commitments', async () => {
      // 4 Masp Keys
      const alice_key = new MaspKey();
      const bob_key = new MaspKey();
      const carol_key = new MaspKey();
      const dave_key = new MaspKey();

      const webbFungibleAssetID = BigNumber.from(1);
      const webbFungibleTokenID = BigNumber.from(0);

      // 4 Masp Utxos
      const alice_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        alice_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );
      const alice_fee_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        alice_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(10)
      );
      const bob_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        carol_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );
      const carol_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        dave_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );

      // Queue deposit
      await unwrappedERC20_1.contract.approve(await maspProxy.contract.address, 400);
      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: toFixedHex(alice_utxo.getPartialCommitment()),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 10,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: toFixedHex(alice_fee_utxo.getPartialCommitment()),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: toFixedHex(bob_utxo.getPartialCommitment()),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      await maspProxy.queueERC20Deposit(
        {
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: toFixedHex(carol_utxo.getPartialCommitment()),
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      // Check MASP Proxy Balance of unwrapped ERC20
      assert.strictEqual(
        (await unwrappedERC20_1.contract.balanceOf(maspProxy.contract.address)).toString(),
        '310'
      );

      // Batch Insert
      await maspProxy.batchDepositERC20s(maspVAnchor, BigNumber.from(0), BigNumber.from(2));
      const queuedUtxos = [alice_utxo, alice_fee_utxo, bob_utxo, carol_utxo];
      const leaves = queuedUtxos.map((x) => x.getCommitment().toString());
      queuedUtxos.forEach((x) => {
        // Maintain tree state after insertions
        // maspVAnchor.depositTree.tree.insert(x.getCommitment());
        x.setIndex(
          BigNumber.from(maspVAnchor.depositTree.tree.indexOf(x.getCommitment().toString()))
        );
      });

      // Do internal shielded transfer
      const alice_utxo_2 = new MaspUtxo(
        BigNumber.from(chainID),
        alice_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(50)
      );

      const bob_utxo_2 = new MaspUtxo(
        BigNumber.from(chainID),
        bob_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(40)
      );

      const fee_output_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        carol_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(10)
      );

      await maspVAnchor.transact(
        webbFungibleAssetID,
        webbFungibleTokenID,
        [alice_utxo],
        [alice_utxo_2, bob_utxo_2],
        BigNumber.from(0),
        webbFungibleAssetID,
        webbFungibleTokenID,
        [alice_fee_utxo],
        [fee_output_utxo],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        BigNumber.from(0),
        sender.address,
        sender.address,
        sender
      );
    });
  });
});
