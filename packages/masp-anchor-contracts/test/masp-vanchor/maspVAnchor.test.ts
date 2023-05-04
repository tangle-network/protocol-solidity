/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { ethers } from 'hardhat';
const TruffleAssert = require('truffle-assertions');

import { BigNumber } from 'ethers';

import {
  getChainIdType,
  ZkComponents,
  maspVAnchorFixtures,
  maspSwapFixtures,
  batchTreeFixtures,
} from '@webb-tools/utils';

import { time } from '@nomicfoundation/hardhat-network-helpers';

import {
  MultiAssetVAnchorProxy,
  MultiAssetVAnchorBatchTree,
  MultiAssetVerifier,
  BatchTreeVerifier,
  SwapProofVerifier,
  Registry,
  RegistryHandler,
  MultiFungibleTokenManager,
  MultiNftTokenManager,
  NftTokenWrapper,
  MaspKey,
  MaspUtxo,
} from '@webb-tools/masp-anchors';

import { PoseidonHasher } from '@webb-tools/anchors';
import { ERC20, ERC721, TokenWrapperHandler, FungibleTokenWrapper } from '@webb-tools/tokens';
import { randomBytes } from 'ethers/lib/utils';
import { toFixedHex } from '@webb-tools/sdk-core';
import { AssetType } from '@webb-tools/interfaces';

const snarkjs = require('snarkjs');
const { toBN } = require('web3-utils');
const { poseidon, eddsa } = require('circomlibjs');

describe('MASP for 2 max edges', () => {
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
  let fungibleWebbToken;
  let nftWebbToken;
  let create2InputWitness;
  let signers;

  before('instantiate zkcomponents and user keypairs', async () => {
    zkComponents2_2 = await maspVAnchorFixtures[22]();
    zkComponents16_2 = await maspVAnchorFixtures[162]();
    swapCircuitZkComponents = await maspSwapFixtures[220]();
    batchTreeZkComponents_4 = await batchTreeFixtures[4]();
    batchTreeZkComponents_8 = await batchTreeFixtures[8]();
    batchTreeZkComponents_16 = await batchTreeFixtures[16]();
    batchTreeZkComponents_32 = await batchTreeFixtures[32]();

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
    const mintTx4 = await unwrappedERC721_1.contract.mint(sender.address, 1);
    await mintTx4.wait();
    const mintTx5 = await unwrappedERC721_1.contract.mint(sender.address, 2);
    await mintTx5.wait();
    const mintTx6 = await unwrappedERC721_1.contract.mint(sender.address, 3);
    await mintTx6.wait();
    const mintTx7 = await unwrappedERC721_1.contract.mint(sender.address, 4);
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
      webbNftSymbol
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

  describe('MASP snark proof native verification on js side', () => {
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
      const whitelistedAssetIDs = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
      inputs.map((x) => x.forceSetIndex(BigNumber.from(0)));
      feeInputs.map((x) => x.forceSetIndex(BigNumber.from(0)));

      const merkleProofsForInputs = inputs.map((x) =>
        MultiAssetVAnchorBatchTree.getMASPMerkleProof(x, maspVAnchor.depositTree.tree)
      );
      const encOutput1 = '0x';
      const encOutput2 = '0x';

      const feeMerkleProofsForInputs = feeInputs.map((x) =>
        MultiAssetVAnchorBatchTree.getMASPMerkleProof(x, maspVAnchor.depositTree.tree)
      );

      const { extDataHash } = await maspVAnchor.generateExtData(
        recipient,
        BigNumber.from(extAmount),
        relayer,
        BigNumber.from(0),
        BigNumber.from(0),
        '0',
        encOutput1,
        encOutput2
      );

      const { allInputs } = await maspVAnchor.generateMASPVAnchorInputs(
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

      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, true);
    });
  });

  describe('Asset Registration smart contract tests', () => {
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
        dummySymbol
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

  describe('MASP smart contract deposit tests max edges = 1', () => {
    it('proxy should queue erc20 deposit', async () => {
      // Queue ERC20 deposit
      const tokenApproveTx = await unwrappedERC20_1.contract.approve(
        await maspProxy.contract.address,
        100
      );
      await tokenApproveTx.wait();
      const depositPartialCommitment = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment)]))
          ),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      // Check that deposit is queued
      const queuedDeposit = await maspProxy.getQueuedDeposits(
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
      const depositPartialCommitment = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await TruffleAssert.reverts(
        maspProxy.queueDeposit(
          {
            assetType: AssetType.ERC20,
            unwrappedToken: unwrappedERC20_1.contract.address,
            wrappedToken: signers[3].address,
            amount: 100,
            assetID: 1,
            tokenID: 0,
            depositPartialCommitment: '0x' + Buffer.from(randomBytes(32)).toString('hex'),
            commitment: toFixedHex(
              BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment)]))
            ),
            isShielded: false,
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
      const depositPartialCommitment = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 1,
          depositPartialCommitment: depositPartialCommitment,
          commitment: toFixedHex(
            BigNumber.from(poseidon([2, 1, 1, BigNumber.from(depositPartialCommitment)]))
          ),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      // Check that deposit is queued
      const queuedDeposit = await maspProxy.getQueuedDeposits(
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
      const depositPartialCommitment = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await TruffleAssert.reverts(
        maspProxy.queueDeposit(
          {
            assetType: AssetType.ERC721,
            unwrappedToken: unwrappedERC721_1.contract.address,
            wrappedToken: signers[4].address,
            amount: 1,
            assetID: 2,
            tokenID: 1,
            depositPartialCommitment: depositPartialCommitment,
            commitment: toFixedHex(
              BigNumber.from(poseidon([2, 1, 1, BigNumber.from(depositPartialCommitment)]))
            ),
            isShielded: false,
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
      const depositPartialCommitment = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await TruffleAssert.reverts(
        maspProxy.queueDeposit(
          {
            assetType: AssetType.ERC721,
            unwrappedToken: unwrappedERC721_1.contract.address,
            wrappedToken: nftWebbToken.contract.address,
            amount: 1,
            assetID: 2,
            tokenID: 1,
            depositPartialCommitment: depositPartialCommitment,
            commitment: toFixedHex(poseidon([2, 1, 1, BigNumber.from(depositPartialCommitment)])),
            isShielded: false,
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
      const depositPartialCommitment1 = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment1,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment1)]))
          ),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment2 = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment2,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment2)]))
          ),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment3 = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment3,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment3)]))
          ),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment4 = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment4,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment4)]))
          ),
          isShielded: false,
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
      await maspProxy.batchInsertDeposits(maspVAnchor, BigNumber.from(0), BigNumber.from(2));

      // Check Reward Unspent Tree is Queued
      const queuedRewardUnspentComms = await maspProxy.getQueuedRewardUnspentCommitments(
        maspVAnchor.contract.address,
        BigNumber.from(0),
        BigNumber.from(4)
      );

      assert.strictEqual(queuedRewardUnspentComms.length, 4);

      // Batch insert into reward unspent tree
      await maspProxy.batchInsertRewardUnspentTree(
        maspVAnchor,
        BigNumber.from(0),
        BigNumber.from(2)
      );
    });

    it('e2e should batch insert erc721 -> queue reward unspent tree -> transfer funds to masp -> batch insert on reward unspent tree', async () => {
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 1);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 2);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 3);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 4);

      // Queue deposits
      const depositPartialCommitment1 = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 1,
          depositPartialCommitment: depositPartialCommitment1,
          commitment: toFixedHex(poseidon([2, 1, 1, BigNumber.from(depositPartialCommitment1)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment2 = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 2,
          depositPartialCommitment: depositPartialCommitment2,
          commitment: toFixedHex(poseidon([2, 2, 1, BigNumber.from(depositPartialCommitment2)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment3 = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 3,
          depositPartialCommitment: depositPartialCommitment3,
          commitment: toFixedHex(poseidon([2, 3, 1, BigNumber.from(depositPartialCommitment3)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment4 = '0x' + Buffer.from(randomBytes(32)).toString('hex');
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 4,
          depositPartialCommitment: depositPartialCommitment4,
          commitment: toFixedHex(poseidon([2, 4, 1, BigNumber.from(depositPartialCommitment4)])),
          isShielded: false,
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
      await maspProxy.batchInsertDeposits(maspVAnchor, BigNumber.from(0), BigNumber.from(2));

      // Check Reward Unspent Tree is Queued
      const queuedRewardUnspentComms = await maspProxy.getQueuedRewardUnspentCommitments(
        maspVAnchor.contract.address,
        BigNumber.from(0),
        BigNumber.from(4)
      );

      assert.strictEqual(queuedRewardUnspentComms.length, 4);

      // Batch insert into reward unspent tree
      await maspProxy.batchInsertRewardUnspentTree(
        maspVAnchor,
        BigNumber.from(0),
        BigNumber.from(2)
      );
    });
  });

  describe('MASP smart contract internal shielded transfer', () => {
    it('e2e should internal shielded transfer with valid transact proof -> reward tree commitments queued -> batch insert reward tree commitments', async () => {
      // 4 Masp Keys
      const alice_key = new MaspKey();
      const bob_key = new MaspKey();
      const carol_key = new MaspKey();

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
        bob_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );
      const carol_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        carol_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );

      // Queue deposit
      await unwrappedERC20_1.contract.approve(await maspProxy.contract.address, 400);
      const depositPartialCommitment1 = toFixedHex(alice_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment1,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment1)]))
          ),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment2 = toFixedHex(alice_fee_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 10,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment2,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 10, BigNumber.from(depositPartialCommitment2)]))
          ),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment3 = toFixedHex(bob_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment3,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment3)]))
          ),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment4 = toFixedHex(carol_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment4,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment4)]))
          ),
          isShielded: false,
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
      await maspProxy.batchInsertDeposits(maspVAnchor, BigNumber.from(0), BigNumber.from(2));

      // Check Reward Unspent Tree is Queued
      const queuedRewardUnspentComms = await maspProxy.getQueuedRewardUnspentCommitments(
        maspVAnchor.contract.address,
        BigNumber.from(0),
        BigNumber.from(4)
      );

      assert.strictEqual(queuedRewardUnspentComms.length, 4);

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
        fungibleWebbToken.contract.address,
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

      await maspProxy.batchInsertDeposits(maspVAnchor, BigNumber.from(4), BigNumber.from(2));

      // Check reward unspent and spent tree is queued
      const queuedRewardUnspentCommsAfterTransfer =
        await maspProxy.getQueuedRewardUnspentCommitments(
          maspVAnchor.contract.address,
          BigNumber.from(0),
          BigNumber.from(6)
        );

      assert.strictEqual(queuedRewardUnspentCommsAfterTransfer.length, 6);

      // Batch insert into reward unspent tree
      await maspProxy.batchInsertRewardUnspentTree(
        maspVAnchor,
        BigNumber.from(0),
        BigNumber.from(2)
      );

      const carol_utxo_2 = new MaspUtxo(
        BigNumber.from(chainID),
        carol_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(50)
      );

      // Do another internal shielded transfer
      await maspVAnchor.transact(
        webbFungibleAssetID,
        webbFungibleTokenID,
        fungibleWebbToken.contract.address,
        [bob_utxo_2],
        [carol_utxo_2],
        BigNumber.from(0),
        webbFungibleAssetID,
        webbFungibleTokenID,
        [],
        [],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        BigNumber.from(0),
        sender.address,
        sender.address,
        sender
      );

      // Batch Insert into Reward Spent Tree
      await maspProxy.batchInsertRewardSpentTree(maspVAnchor, BigNumber.from(0), BigNumber.from(2));
    });
  });

  describe('MASP smart contract withdraw tests', () => {
    it('e2e should withdraw ERC20 with valid transact proof -> check token balances', async () => {
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
      const depositPartialCommitment1 = toFixedHex(alice_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment1,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment1)]))
          ),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment2 = toFixedHex(alice_fee_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 10,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment2,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 10, BigNumber.from(depositPartialCommitment2)]))
          ),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment3 = toFixedHex(bob_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment3,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment3)]))
          ),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment4 = toFixedHex(carol_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment4,
          commitment: toFixedHex(
            BigNumber.from(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment4)]))
          ),
          isShielded: false,
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
      await maspProxy.batchInsertDeposits(maspVAnchor, BigNumber.from(0), BigNumber.from(2));

      // Do withdraw.
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

      const aliceAddress = signers[4];

      await maspVAnchor.transact(
        webbFungibleAssetID,
        webbFungibleTokenID,
        fungibleWebbToken.contract.address,
        [alice_utxo],
        [alice_utxo_2, bob_utxo_2],
        BigNumber.from(0),
        webbFungibleAssetID,
        webbFungibleTokenID,
        [alice_fee_utxo],
        [fee_output_utxo],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        BigNumber.from(0),
        aliceAddress.address,
        sender.address,
        sender
      );

      // Should withdraw but not unwrap due to how we set the wrapUnwrapTOken
      assert.strictEqual(
        (await fungibleWebbToken.contract.balanceOf(aliceAddress.address)).toString(),
        '10'
      );
    });

    it('e2e should withdraw ERC721 with valid transact proof -> check token balances', async () => {
      // 4 Masp Keys
      const alice_key = new MaspKey();
      const bob_key = new MaspKey();
      const carol_key = new MaspKey();
      const dave_key = new MaspKey();

      const webbNftAssetID = BigNumber.from(2);

      // 4 Masp Utxos
      const alice_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        alice_key,
        webbNftAssetID,
        BigNumber.from(1),
        BigNumber.from(1)
      );
      const bob_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        bob_key,
        webbNftAssetID,
        BigNumber.from(2),
        BigNumber.from(1)
      );
      const carol_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        carol_key,
        webbNftAssetID,
        BigNumber.from(3),
        BigNumber.from(1)
      );
      const dave_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        dave_key,
        webbNftAssetID,
        BigNumber.from(4),
        BigNumber.from(1)
      );

      // Queue deposits
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 1);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 2);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 3);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 4);

      // Queue deposits
      const depositPartialCommitment1 = toFixedHex(alice_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 1,
          depositPartialCommitment: depositPartialCommitment1,
          commitment: toFixedHex(poseidon([2, 1, 1, BigNumber.from(depositPartialCommitment1)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment2 = toFixedHex(bob_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 2,
          depositPartialCommitment: depositPartialCommitment2,
          commitment: toFixedHex(poseidon([2, 2, 1, BigNumber.from(depositPartialCommitment2)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment3 = toFixedHex(carol_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 3,
          depositPartialCommitment: depositPartialCommitment3,
          commitment: toFixedHex(poseidon([2, 3, 1, BigNumber.from(depositPartialCommitment3)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment4 = toFixedHex(dave_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 4,
          depositPartialCommitment: depositPartialCommitment4,
          commitment: toFixedHex(poseidon([2, 4, 1, BigNumber.from(depositPartialCommitment4)])),
          isShielded: false,
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
      await maspProxy.batchInsertDeposits(maspVAnchor, BigNumber.from(0), BigNumber.from(2));

      const webbFeeAssetID = BigNumber.from(1);
      const webbFeeTokenID = BigNumber.from(0);
      const aliceAddress = signers[4];
      await maspVAnchor.transact(
        webbNftAssetID,
        BigNumber.from(1),
        nftWebbToken.contract.address,
        [alice_utxo],
        [],
        BigNumber.from(0),
        webbFeeAssetID,
        webbFeeTokenID,
        [],
        [],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        BigNumber.from(0),
        aliceAddress.address,
        sender.address,
        sender
      );
      // Check token balances
      // Should withdraw but not unwrap due to how we set the wrapUnwrapToken
      assert.strictEqual((await nftWebbToken.contract.ownerOf(1)).toString(), aliceAddress.address);
    });
  });

  describe('swap tests', () => {
    it('should swap an erc721 for erc20', async () => {
      // 4 Masp Keys
      const alice_key = new MaspKey();
      const bob_key = new MaspKey();
      const carol_key = new MaspKey();
      const dave_key = new MaspKey();
      // Queue ERC20 deposits
      const webbFungibleAssetID = BigNumber.from(1);
      const webbFungibleTokenID = BigNumber.from(0);
      // 4 Masp Utxos
      const alice_fungible_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        alice_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );
      const bob_fungible_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        bob_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );
      const carol_fungible_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        carol_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );
      const dave_fungible_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        dave_key,
        webbFungibleAssetID,
        webbFungibleTokenID,
        BigNumber.from(100)
      );

      // Queue deposit
      await unwrappedERC20_1.contract.approve(await maspProxy.contract.address, 400);
      const depositPartialCommitment1 = toFixedHex(alice_fungible_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment1,
          commitment: toFixedHex(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment1)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      const depositPartialCommitment2 = toFixedHex(bob_fungible_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment2,
          commitment: toFixedHex(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment2)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      const depositPartialCommitment3 = toFixedHex(carol_fungible_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment3,
          commitment: toFixedHex(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment3)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );
      const depositPartialCommitment4 = toFixedHex(dave_fungible_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC20,
          unwrappedToken: unwrappedERC20_1.contract.address,
          wrappedToken: fungibleWebbToken.contract.address,
          amount: 100,
          assetID: 1,
          tokenID: 0,
          depositPartialCommitment: depositPartialCommitment4,
          commitment: toFixedHex(poseidon([1, 0, 100, BigNumber.from(depositPartialCommitment4)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      // Queue ERC721 deposits
      const webbNftAssetID = BigNumber.from(2);

      // 4 Masp Utxos
      const alice_nft_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        alice_key,
        webbNftAssetID,
        BigNumber.from(1),
        BigNumber.from(1)
      );
      const bob_nft_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        bob_key,
        webbNftAssetID,
        BigNumber.from(2),
        BigNumber.from(1)
      );
      const carol_nft_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        carol_key,
        webbNftAssetID,
        BigNumber.from(3),
        BigNumber.from(1)
      );
      const dave_nft_utxo = new MaspUtxo(
        BigNumber.from(chainID),
        dave_key,
        webbNftAssetID,
        BigNumber.from(4),
        BigNumber.from(1)
      );

      // Queue deposits
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 1);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 2);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 3);
      await unwrappedERC721_1.contract.approve(await maspProxy.contract.address, 4);

      // Queue deposits
      const depositPartialCommitment5 = toFixedHex(alice_nft_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 1,
          depositPartialCommitment: depositPartialCommitment5,
          commitment: toFixedHex(poseidon([2, 1, 1, BigNumber.from(depositPartialCommitment5)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment6 = toFixedHex(bob_nft_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 2,
          depositPartialCommitment: depositPartialCommitment6,
          commitment: toFixedHex(poseidon([2, 2, 1, BigNumber.from(depositPartialCommitment6)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment7 = toFixedHex(carol_nft_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 3,
          depositPartialCommitment: depositPartialCommitment7,
          commitment: toFixedHex(poseidon([2, 3, 1, BigNumber.from(depositPartialCommitment7)])),
          isShielded: false,
          proxiedMASP: maspVAnchor.contract.address,
        },
        {
          from: sender.address,
        }
      );

      const depositPartialCommitment8 = toFixedHex(dave_nft_utxo.getPartialCommitment());
      await maspProxy.queueDeposit(
        {
          assetType: AssetType.ERC721,
          unwrappedToken: unwrappedERC721_1.contract.address,
          wrappedToken: nftWebbToken.contract.address,
          amount: 1,
          assetID: 2,
          tokenID: 4,
          depositPartialCommitment: depositPartialCommitment8,
          commitment: toFixedHex(poseidon([2, 4, 1, BigNumber.from(depositPartialCommitment8)])),
          isShielded: false,
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

      // Batch Insert ERC20s
      await maspProxy.batchInsertDeposits(maspVAnchor, BigNumber.from(0), BigNumber.from(2));

      // Batch Insert ERC721s
      await maspProxy.batchInsertDeposits(maspVAnchor, BigNumber.from(4), BigNumber.from(2));

      // Alice will swap 1 NFT for 50 of Bob's ERC20s.
      // Form Change and Receive Records
      const aliceSpendRecord = alice_nft_utxo;
      const bobSpendRecord = bob_fungible_utxo;

      const aliceReceiveRecord = new MaspUtxo(
        BigNumber.from(chainID),
        alice_key,
        bob_fungible_utxo.assetID,
        bob_fungible_utxo.tokenID,
        BigNumber.from(50)
      );
      const bobReceiveRecord = new MaspUtxo(
        BigNumber.from(chainID),
        bob_key,
        alice_nft_utxo.assetID,
        alice_nft_utxo.tokenID,
        BigNumber.from(1)
      );

      const aliceChangeRecord = new MaspUtxo(
        BigNumber.from(chainID),
        alice_key,
        alice_nft_utxo.assetID,
        alice_nft_utxo.tokenID,
        BigNumber.from(0)
      );
      const bobChangeRecord = new MaspUtxo(
        BigNumber.from(chainID),
        bob_key,
        bob_fungible_utxo.assetID,
        bob_fungible_utxo.tokenID,
        BigNumber.from(50)
      );

      // getting timestamp
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const t = blockBefore.timestamp;
      await time.setNextBlockTimestamp(t + 5000);
      const tPrime = t + 10000;

      const swapMessageHash = poseidon([
        aliceChangeRecord.getCommitment(),
        aliceReceiveRecord.getCommitment(),
        bobChangeRecord.getCommitment(),
        bobReceiveRecord.getCommitment(),
        t,
        tPrime,
      ]);

      const aliceSig = eddsa.signPoseidon(alice_key.sk, swapMessageHash);
      const bobSig = eddsa.signPoseidon(bob_key.sk, swapMessageHash);

      // Execute swap
      await maspVAnchor.swap(
        aliceSpendRecord,
        aliceChangeRecord,
        aliceReceiveRecord,
        bobSpendRecord,
        bobChangeRecord,
        bobReceiveRecord,
        aliceSig,
        bobSig,
        BigNumber.from(t),
        BigNumber.from(tPrime),
        BigNumber.from(t + 1000),
        sender
      );

      // Check reward trees are queued
      const queuedRewardSpentComms = await maspProxy.getQueuedRewardSpentCommitments(
        maspVAnchor.contract.address,
        BigNumber.from(0),
        BigNumber.from(2)
      );
      assert.strictEqual(queuedRewardSpentComms.length, 2);

      // Double spending spend commitments should revert
      await TruffleAssert.reverts(
        maspVAnchor.transact(
          webbNftAssetID,
          BigNumber.from(1),
          nftWebbToken.contract.address,
          [alice_nft_utxo],
          [],
          BigNumber.from(0),
          webbFungibleAssetID,
          webbFungibleTokenID,
          [],
          [],
          [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          BigNumber.from(0),
          sender.address,
          sender.address,
          sender
        ),
        'Input is already spent'
      );

      // Alice can spend her new notes and Bob can spend his new notes
      await maspProxy.batchInsertDeposits(maspVAnchor, BigNumber.from(8), BigNumber.from(2));

      await maspVAnchor.transact(
        webbFungibleAssetID,
        webbFungibleTokenID,
        fungibleWebbToken.contract.address,
        [aliceReceiveRecord],
        [],
        BigNumber.from(0),
        webbFungibleAssetID,
        webbFungibleTokenID,
        [],
        [],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        BigNumber.from(0),
        sender.address,
        sender.address,
        sender
      );
    });
  });
});
