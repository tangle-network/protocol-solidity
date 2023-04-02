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

import { MultiAssetVAnchorProxy, MultiAssetVAnchorBatchUpdatableTree, PoseidonHasher, BatchTreeVerifier, SwapProofVerifier } from '@webb-tools/anchors';

import { MultiAssetVerifier } from '@webb-tools/vbridge';
import { writeFileSync } from 'fs';
import { Registry, RegistryHandler, MultiFungibleTokenManager, MultiNftTokenManager } from '@webb-tools/tokens';
import { randomBytes } from 'ethers/lib/utils';

const BN = require('bn.js');
const path = require('path');
const { poseidon } = require('circomlibjs');
const snarkjs = require('snarkjs');
const { toBN } = require('web3-utils');
const { babyjub } = require('circomlibjs');

describe('MASPVAnchor for 2 max edges', () => {
  let maspVAnchor: MultiAssetVAnchorBatchUpdatableTree;
  let zkComponents2_2: ZkComponents;
  let zkComponents16_2: ZkComponents;
  let swapCircuitZkComponents: ZkComponents;
  let batchTreeZkComponents_4: ZkComponents;
  let batchTreeZkComponents_8: ZkComponents;
  let batchTreeZkComponents_16: ZkComponents;
  let batchTreeZkComponents_32: ZkComponents;
  const levels = 30;
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
  let wrappedERC20;
  let unwrappedERC721_1;
  let unwrappedERC721_2;
  let unwrappedERC721_3;
  let wrappedERC721_1;
  let wrappedERC721_2;
  let wrappedERC721_3;
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
    signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    dummyBridgeSigner = signers[1];
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);
    registry = await Registry.createRegistry(sender);
    registryHandler = await RegistryHandler.createRegistryHandler(await dummyBridgeSigner.getAddress(), [await registry.createResourceId()], [ registry.contract.address], dummyBridgeSigner);
    multiFungibleTokenManager = await MultiFungibleTokenManager.createMultiFungibleTokenManager(sender);
    multiNftTokenManager = await MultiNftTokenManager.createMultiNftTokenManager(sender);
    masterFeeRecipient = await signers[2].getAddress();
    transactionVerifier = await MultiAssetVerifier.createVerifier(sender);
    maspProxy = await MultiAssetVAnchorProxy.createMultiAssetVAnchorProxy(hasherInstance.contract.address, sender);
    swapVerifier = await SwapProofVerifier.createVerifier(sender);
    batchVerifier = await BatchTreeVerifier.createVerifier(sender);
    dummyAnchorHandlerAddress = await signers[3].getAddress();
    maspVAnchor = await MultiAssetVAnchorBatchUpdatableTree.createMASPVAnchorBatchTree(
      registry.contract.address,
      transactionVerifier.contract.address,
      swapVerifier.contract.address,
      levels,
      dummyAnchorHandlerAddress,
      maxEdges,
      zkComponents2_2,
      zkComponents16_2,
      swapCircuitZkComponents,
      batchVerifier.contract.address,
      hasherInstance.contract.address,
      maspProxy.contract.address,
      batchTreeZkComponents_4,
      batchTreeZkComponents_8,
      batchTreeZkComponents_16,
      batchTreeZkComponents_32,
      sender,
    )
    // Initialize Registry
    await registry.initialize(
      multiFungibleTokenManager.contract.address,
      multiNftTokenManager.contract.address,
      registryHandler.contract.address,
      masterFeeRecipient,
      maspVAnchor.contract.address,
    );
    // Initialize MASP Proxy
    await maspProxy.initialize([maspVAnchor.contract]);
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
      const encOutput1 = '0x';
      const encOutput2 = '0x';

      const feeMerkleProofsForInputs = feeInputs.map((x) => maspVAnchor.getMASPMerkleProof(x));
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

      const { allInputs, publicInputs } = await MultiAssetVAnchorBatchUpdatableTree.generateMASPVAnchorInputs(
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

  describe('asset registration smart contract tests', () => {
    it('registry handler should register fungible token', async () => {
      const dummyTokenHandler = "0x" + Buffer.from(randomBytes(20)).toString('hex');
      const dummyAssetId = 1;
      const dummyTokenName = "0x" + Buffer.from(ethers.utils.toUtf8Bytes("webb-ether")).toString('hex');
      const dummyTokenSymbol = "0x" + Buffer.from(ethers.utils.toUtf8Bytes("webbeth")).toString('hex');
      const dummySalt = "0x" + Buffer.from(randomBytes(32)).toString('hex');
      const dummyLimit = "0x" + Buffer.from(randomBytes(32)).toString('hex');
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
        dummyIsNativeAllowed,
      );
      // Call executeProposal function
      const registerFungibleTokenTx = await registryHandler.contract.executeProposal(await registry.createResourceId(), proposalData);
      await registerFungibleTokenTx.wait();
      // Check that fungible token is registered on the Registry contract
      const wrappedAssetAddr = await registry.contract.idToWrappedAsset(1);
      assert.strictEqual((await registry.contract.wrappedAssetToId(wrappedAssetAddr)).toString(), dummyAssetId.toString());
    });

    it('registry handler should register non-fungible token', async () => {
      const dummyTokenHandler = "0x" + Buffer.from(randomBytes(20)).toString('hex');
      const dummyAssetId = 1;
      const dummyUnwrappedNftAddr = "0x" + Buffer.from(randomBytes(20)).toString('hex');
      const dummySalt = "0x" + Buffer.from(randomBytes(32)).toString('hex');
      const dummyUri = "0x" + Buffer.from(randomBytes(64)).toString('hex');
      const proposalData = await registry.getRegisterNftTokenProposalData(
        dummyTokenHandler,
        dummyAssetId,
        dummyUnwrappedNftAddr,
        dummySalt,
        dummyUri,
      );
      // Call executeProposal function
      const registerNftTokenTx = await registryHandler.contract.executeProposal(await registry.createResourceId(), proposalData);
      await registerNftTokenTx.wait();
      // Check that fungible token is registered on the Registry contract
      const wrappedAssetAddr = await registry.contract.idToWrappedAsset(1);
      assert.strictEqual((await registry.contract.wrappedAssetToId(wrappedAssetAddr)).toString(), dummyAssetId.toString());
    });
  });

  describe('masp smart contract deposit tests max edges = 1', () => {
    it('proxy should queue erc20 deposit', async () => {});

    it('proxy should NOT queue erc20 deposit for unregistered asset', async () => {});

    it('proxy should queue erc721 deposit', async () => {});

    it('proxy should NOT queue erc721 deposit for unregistered asset', async () => {});

    it('proxy should NOT queue deposit for masp it does not proxy for', async () => {});

    it('e2e should batch insert erc20/721 -> queue reward unspent tree -> transfer funds to masp -> batch insert on reward unspent tree', async () => {});

    it('should NOT batch insert erc20 with invalid batch proof', async () => {});

    it('should NOT batch insert erc721 with invalid batch proof', async () => {});
  });

  describe('masp smart contract internal shielded transfer', () => {
    it('e2e should internal shielded transfer with valid transact proof -> reward tree commitments queued -> batch insert reward tree commitments', async () => {});

    it('should NOT internal shielded transfer with invalid transact proof (invalid MASP key)', async () => {});

    it('should NOT internal shielded transfer with invalid transact proof (invalid output commitments)', async () => {});

    it('should NOT internal shielded transfer with invalid transact proof (invalid Merkle proof)', async () => {});

    it('should NOT internal shielded transfer with invalid transact proof (fee token not whitelisted)', async () => {});

    it('should NOT internal shielded transfer with invalid transact proof (input nullifiers not well-formed)', async () => {});

    it('should NOT be able to double spend internal shieled transfer)', async () => {});
  });

  describe('masp smart contract withdraw ERC20', () => {
    it('e2e should withdraw ERC20 with valid transact proof -> reward tree commitments queued -> funds transferred -> batch insert reward tree commitments', async () => {});

    it('should withdraw AND unwrap ERC20 with valid transact proof -> reward tree commitments queued -> funds transferred', async () => {});

    it('should NOT withdraw ERC20 with invalid transact proof (invalid MASP key)', async () => {});

    it('should NOT withdraw ERC20 with invalid transact proof (invalid output commitments)', async () => {});

    it('should NOT withdraw ERC20 with invalid transact proof (invalid Merkle proof)', async () => {});

    it('should NOT withdraw ERC20 with invalid transact proof (fee token not whitelisted)', async () => {});

    it('should NOT withdraw ERC20 with invalid transact proof (input nullifiers not well-formed)', async () => {});

    it('should NOT be able to double spend ERC721 withdraw)', async () => {});
  });

  describe('masp smart contract withdraw ERC721', () => {
    it('should withdraw ERC721 with valid transact proof -> reward tree commitments queued -> funds transferred -> batch insert reward tree commitments', async () => {});

    it('should withdraw AND unwrap ERC721 with valid transact proof -> reward tree commitments queued -> funds transferred', async () => {});

    it('should NOT withdraw ERC721 with invalid transact proof (invalid MASP key)', async () => {});

    it('should NOT withdraw ERC721 with invalid transact proof (invalid output commitments)', async () => {});

    it('should NOT withdraw ERC721 with invalid transact proof (invalid Merkle proof)', async () => {});

    it('should NOT withdraw ERC721 with invalid transact proof (fee token not whitelisted)', async () => {});

    it('should NOT withdraw ERC721 with invalid transact proof (input nullifiers not well-formed)', async () => {});

    it('should NOT be able to double spend ERC721 withdraw)', async () => {});
  });

  describe('masp smart contract swapping', () => {
    it('e2e should swap with valid proof -> update reward tree queues -> spend created commitments', async () => {});

    it('should NOT swap with invalid proof (invalid Alice/Bob sigs)', async () => {});

    it('should NOT swap with invalid proof (funds created out of thin air)', async () => {});

    it('should NOT be able to double spend swapped commitmnets', async () => {});

    it('should NOT be able to swap outdated swaps', async () => {});
  });
});
