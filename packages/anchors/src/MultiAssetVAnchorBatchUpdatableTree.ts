import { MultiAssetVAnchor } from './MultiAssetVAnchor';
import { MultiAssetVAnchorProxy } from './MultiAssetVAnchorProxy';
import {
  MASPVAnchorEncodeInputs__factory,
  MultiAssetVAnchorTree as MultiAssetVAnchorTreeContract,
} from '@webb-tools/contracts';
import { SwapEncodeInputs__factory } from '@webb-tools/contracts';
import {
  MultiAssetVAnchorBatchTree as MultiAssetVAnchorBatchTreeContract,
  MultiAssetVAnchorBatchTree__factory,
} from '@webb-tools/contracts';
import { ProxiedBatchTreeUpdater } from './ProxiedBatchTreeUpdater';
import { getChainIdType, MaspKey, MaspUtxo, ZkComponents } from '@webb-tools/utils';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import {
  ProxiedBatchMerkleTree as ProxiedBatchMerkleTreeContract,
  ProxiedBatchMerkleTree__factory,
} from '@webb-tools/contracts';
import { toFixedHex } from '@webb-tools/sdk-core';
import { Registry } from '@webb-tools/tokens';

export class MultiAssetVAnchorBatchUpdatableTree extends MultiAssetVAnchor {
  depositTree: ProxiedBatchTreeUpdater;
  unspentTree: ProxiedBatchTreeUpdater;
  spentTree: ProxiedBatchTreeUpdater;

  // Constructor
  constructor(
    contract: MultiAssetVAnchorBatchTreeContract,
    levels: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    swapCircuitZkComponents: ZkComponents,
    depositTree: ProxiedBatchTreeUpdater,
    unspentTree: ProxiedBatchTreeUpdater,
    spentTree: ProxiedBatchTreeUpdater,
    signer: ethers.Signer
  ) {
    super(
      contract,
      levels,
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents,
      swapCircuitZkComponents,
      signer
    );

    this.depositTree = depositTree;
    this.unspentTree = unspentTree;
    this.spentTree = spentTree;
  }

  // Create a new MultiAssetVAnchorBatchUpdatableTree

  public static async createMASPVAnchorBatchTree(
    registry: string,
    verifier: string,
    swapVerifier: string,
    levels: number,
    handler: string,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    swapCircuitZkComponents: ZkComponents,
    batchVerifierAddr: string,
    hasherAddr: string,
    proxyAddr: string,
    zkComponents_4: ZkComponents,
    zkComponents_8: ZkComponents,
    zkComponents_16: ZkComponents,
    zkComponents_32: ZkComponents,
    signer: ethers.Signer
  ) {
    const encodeLibraryFactory = new MASPVAnchorEncodeInputs__factory(signer);
    const encodeLibrary = await encodeLibraryFactory.deploy();
    await encodeLibrary.deployed();

    const swapEncodeLibraryFactory = new MASPVAnchorEncodeInputs__factory(signer);
    const swapEncodeLibrary = await swapEncodeLibraryFactory.deploy();
    await swapEncodeLibrary.deployed();

    const factory = new MultiAssetVAnchorBatchTree__factory(
      {
        ['contracts/libs/MASPVAnchorEncodeInputs.sol:MASPVAnchorEncodeInputs']:
          encodeLibrary.address,
        ['contracts/libs/SwapEncodeInputs.sol:SwapEncodeInputs']: swapEncodeLibrary.address,
      },
      signer
    );

    const depositTree = await ProxiedBatchTreeUpdater.createProxiedBatchTreeUpdater(
      batchVerifierAddr,
      levels,
      hasherAddr,
      proxyAddr,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32,
      signer
    );
    const unspentTree = await ProxiedBatchTreeUpdater.createProxiedBatchTreeUpdater(
      batchVerifierAddr,
      levels,
      hasherAddr,
      proxyAddr,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32,
      signer
    );
    const spentTree = await ProxiedBatchTreeUpdater.createProxiedBatchTreeUpdater(
      batchVerifierAddr,
      levels,
      hasherAddr,
      proxyAddr,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32,
      signer
    );
    const proxy = proxyAddr;

    const maspVAnchorBatchTree = await factory.deploy(
      registry,
      unspentTree.contract.address,
      spentTree.contract.address,
      proxy,
      verifier,
      swapVerifier,
      levels,
      hasherAddr,
      handler,
      await depositTree.contract.treeUpdateVerifier(),
      maxEdges,
      {}
    );
    await maspVAnchorBatchTree.deployed();
    const createdMASPVAnchorBatchTree = new MultiAssetVAnchorBatchUpdatableTree(
      maspVAnchorBatchTree,
      levels,
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents,
      swapCircuitZkComponents,
      depositTree,
      unspentTree,
      spentTree,
      signer
    );
    const tx = await createdMASPVAnchorBatchTree.contract.initialize(
      BigNumber.from('1'),
      BigNumber.from(2).pow(256).sub(1)
    );
    await tx.wait();
    return createdMASPVAnchorBatchTree;
  }

  // Connect to an existing MultiAssetVAnchorBatchUpdatableTree
  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    swapCircuitZkComponents: ZkComponents,
    depositTreeAddr: string,
    unspentTreeAddr: string,
    spentTreeAddr: string,
    zkComponents_4: ZkComponents,
    zkComponents_8: ZkComponents,
    zkComponents_16: ZkComponents,
    zkComponents_32: ZkComponents,
    signer: ethers.Signer
  ) {
    const masp = MultiAssetVAnchorBatchTree__factory.connect(address, signer);
    const depositTree = await ProxiedBatchTreeUpdater.connect(
      depositTreeAddr,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32,
      signer
    );
    const unspentTree = await ProxiedBatchTreeUpdater.connect(
      unspentTreeAddr,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32,
      signer
    );
    const spentTree = await ProxiedBatchTreeUpdater.connect(
      spentTreeAddr,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32,
      signer
    );
    const maxEdges = await masp.maxEdges();
    const treeHeight = await masp.levels();
    const createdAnchor = new MultiAssetVAnchorBatchUpdatableTree(
      masp,
      treeHeight,
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents,
      swapCircuitZkComponents,
      depositTree,
      unspentTree,
      spentTree,
      signer
    );
    return createdAnchor;
  }

  public async transact(
    assetID: BigNumber,
    tokenID: BigNumber,
    inputs: MaspUtxo[],
    outputs: MaspUtxo[],
    alphas: string[],
    fee: BigNumber,
    feeAssetID: BigNumber,
    feeTokenID: BigNumber,
    feeInputs: MaspUtxo[],
    feeOutputs: MaspUtxo[],
    fee_alphas: string[],
    whitelistedAssetIds: number[],
    refund: BigNumber,
    recipient: string,
    relayer: string,
    signer: ethers.Signer
  ): Promise<ethers.ContractReceipt> {
    // Default UTXO chain ID will match with the configured signer's chain ID
    const evmId = await this.signer.getChainId();
    const chainId = getChainIdType(evmId);
    const registry = await Registry.connect(await this.contract.registry(), signer);
    const wrappedToken = await registry.contract.getWrappedAssetAddress(assetID);
    const dummyMaspKey = new MaspKey();

    while (inputs.length !== 2 && inputs.length < 16) {
      const dummyUtxo = new MaspUtxo(
        BigNumber.from(chainId),
        dummyMaspKey,
        assetID,
        tokenID,
        BigNumber.from(0)
      )
      inputs.push(
        dummyUtxo
      );
      dummyUtxo.setIndex(BigNumber.from(0));
    }

    if (outputs.length < 2) {
      while (outputs.length < 2) {
        outputs.push(
          new MaspUtxo(
            BigNumber.from(chainId),
            dummyMaspKey,
            assetID,
            tokenID,
            BigNumber.from(0)
          )
        );
      }
    }

    while (feeInputs.length !== 2 && feeInputs.length < 16) {
      const dummyUtxo =    new MaspUtxo(
        BigNumber.from(chainId),
        dummyMaspKey,
        feeAssetID,
        feeTokenID,
        BigNumber.from(0)
      )
      feeInputs.push(
        dummyUtxo
      );
      dummyUtxo.setIndex(BigNumber.from(0));
    }

    if (feeOutputs.length < 2) {
      while (feeOutputs.length < 2) {
        feeOutputs.push(
          new MaspUtxo(
            BigNumber.from(chainId),
            dummyMaspKey,
            feeAssetID,
            feeTokenID,
            BigNumber.from(0)
          )
        );
      }
    }

    const merkleProofs = inputs.map((x) => MultiAssetVAnchor.getMASPMerkleProof(x, this.depositTree.tree));
    const feeMerkleProofs = feeInputs.map((x) => MultiAssetVAnchor.getMASPMerkleProof(x, this.depositTree.tree));

    let extAmount = fee
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)));

    const { extData, extDataHash } = await this.generateExtData(
      recipient,
      extAmount,
      relayer,
      fee,
      refund,
      wrappedToken,
      toFixedHex(0), //outputs[0].encrypt(outputs[0].maspKey).toString(),
      toFixedHex(0), // outputs[1].encrypt(outputs[1].maspKey).toString()
    );

    const roots = await this.populateRootsForProof();

    const publicInputs = await this.publicInputsWithProof(
      roots,
      chainId,
      assetID.toNumber(),
      tokenID.toNumber(),
      inputs,
      outputs,
      alphas,
      feeAssetID.toNumber(),
      feeTokenID.toNumber(),
      whitelistedAssetIds,
      feeInputs,
      feeOutputs,
      fee_alphas,
      extAmount,
      BigNumber.from(fee),
      extDataHash,
      merkleProofs,
      feeMerkleProofs
    );

    const auxInputs = MultiAssetVAnchor.auxInputsToBytes(publicInputs);

    const tx = await this.contract.transact(
      '0x' + publicInputs.proof,
      auxInputs,
      {
        recipient: extData.recipient,
        extAmount: extData.extAmount,
        relayer: extData.relayer,
        fee: extData.fee,
        refund: extData.refund,
        token: extData.token,
      },
      {
        roots: MultiAssetVAnchor.createRootsBytes(publicInputs.roots),
        extensionRoots: '0x',
        inputNullifiers: publicInputs.inputNullifier,
        outputCommitments: [publicInputs.outputCommitment[0], publicInputs.outputCommitment[1]],
        publicAmount: publicInputs.publicAmount,
        extDataHash: publicInputs.extDataHash,
      },
      {
        encryptedOutput1: extData.encryptedOutput1,
        encryptedOutput2: extData.encryptedOutput2,
      },
      {}
    );

    const receipt = await tx.wait();

    return receipt;
  }
}
