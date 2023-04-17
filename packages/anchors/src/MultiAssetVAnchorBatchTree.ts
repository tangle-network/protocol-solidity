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
import { ProxiedBatchTree } from './ProxiedBatchTree';
import { getChainIdType, MaspKey, MaspUtxo, ZkComponents } from '@webb-tools/utils';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import {
  ProxiedBatchTree as ProxiedBatchTreeContract,
  ProxiedBatchTree__factory,
} from '@webb-tools/contracts';
import { toFixedHex } from '@webb-tools/sdk-core';
import { Registry } from '@webb-tools/tokens';

export class MultiAssetVAnchorBatchTree extends MultiAssetVAnchor {
  depositTree: ProxiedBatchTree;
  unspentTree: ProxiedBatchTree;
  spentTree: ProxiedBatchTree;

  // Constructor
  constructor(
    contract: MultiAssetVAnchorBatchTreeContract,
    depositTree: ProxiedBatchTree,
    unspentTree: ProxiedBatchTree,
    spentTree: ProxiedBatchTree,
    levels: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    swapCircuitZkComponents: ZkComponents,
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

  public static async createMultiAssetVAnchorBatchTree(
    registry: string,
    transactVerifierAddr: string,
    batchVerifierAddr: string,
    swapVerifierAddr: string,
    handlerAddr: string,
    hasherAddr: string,
    proxyAddr: string,
    levels: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    swapCircuitZkComponents: ZkComponents,
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

    const depositTree = await ProxiedBatchTree.createProxiedBatchTree(
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
    const unspentTree = await ProxiedBatchTree.createProxiedBatchTree(
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
    const spentTree = await ProxiedBatchTree.createProxiedBatchTree(
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
      transactVerifierAddr,
      swapVerifierAddr,
      await depositTree.contract.treeUpdateVerifier(),
      handlerAddr,
      hasherAddr,
      proxy,
      unspentTree.contract.address,
      spentTree.contract.address,
      levels,
      maxEdges,
      {}
    );
    await maspVAnchorBatchTree.deployed();
    const createdMASPVAnchorBatchTree = new MultiAssetVAnchorBatchTree(
      maspVAnchorBatchTree,
      depositTree,
      unspentTree,
      spentTree,
      levels,
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents,
      swapCircuitZkComponents,
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
    maspAddress: string,
    depositTreeAddr: string,
    unspentTreeAddr: string,
    spentTreeAddr: string,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    swapCircuitZkComponents: ZkComponents,
    zkComponents_4: ZkComponents,
    zkComponents_8: ZkComponents,
    zkComponents_16: ZkComponents,
    zkComponents_32: ZkComponents,
    signer: ethers.Signer
  ) {
    const masp = MultiAssetVAnchorBatchTree__factory.connect(maspAddress, signer);
    const depositTree = await ProxiedBatchTree.connect(
      depositTreeAddr,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32,
      signer
    );
    const unspentTree = await ProxiedBatchTree.connect(
      unspentTreeAddr,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32,
      signer
    );
    const spentTree = await ProxiedBatchTree.connect(
      spentTreeAddr,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32,
      signer
    );
    const maxEdges = await masp.maxEdges();
    const treeHeight = await masp.levels();
    const createdAnchor = new MultiAssetVAnchorBatchTree(
      masp,
      depositTree,
      unspentTree,
      spentTree,
      treeHeight,
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents,
      swapCircuitZkComponents,
      signer
    );
    return createdAnchor;
  }

  public async transact(
    assetID: BigNumberish,
    tokenID: BigNumberish,
    inputs: MaspUtxo[],
    outputs: MaspUtxo[],
    fee: BigNumberish, // Most likely 0 because fee will be paid through feeInputs
    feeAssetID: BigNumberish,
    feeTokenID: BigNumberish,
    feeInputs: MaspUtxo[],
    feeOutputs: MaspUtxo[],
    whitelistedAssetIds: BigNumberish[],
    refund: BigNumberish,
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
        BigNumber.from(assetID),
        BigNumber.from(tokenID),
        BigNumber.from(0)
      );
      inputs.push(dummyUtxo);
      dummyUtxo.setIndex(BigNumber.from(0));
    }

    if (outputs.length < 2) {
      while (outputs.length < 2) {
        outputs.push(
          new MaspUtxo(
            BigNumber.from(chainId),
            dummyMaspKey,
            BigNumber.from(assetID),
            BigNumber.from(tokenID),
            BigNumber.from(0)
          )
        );
      }
    }

    while (feeInputs.length !== 2 && feeInputs.length < 16) {
      const dummyUtxo = new MaspUtxo(
        BigNumber.from(chainId),
        dummyMaspKey,
        BigNumber.from(feeAssetID),
        BigNumber.from(feeTokenID),
        BigNumber.from(0)
      );
      feeInputs.push(dummyUtxo);
      dummyUtxo.setIndex(BigNumber.from(0));
    }

    if (feeOutputs.length < 2) {
      while (feeOutputs.length < 2) {
        feeOutputs.push(
          new MaspUtxo(
            BigNumber.from(chainId),
            dummyMaspKey,
            BigNumber.from(feeAssetID),
            BigNumber.from(feeTokenID),
            BigNumber.from(0)
          )
        );
      }
    }

    const merkleProofs = inputs.map((x) =>
      MultiAssetVAnchor.getMASPMerkleProof(x, this.depositTree.tree)
    );
    const feeMerkleProofs = feeInputs.map((x) =>
      MultiAssetVAnchor.getMASPMerkleProof(x, this.depositTree.tree)
    );

    let extAmount = BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)));

    const { extData, extDataHash } = await this.generateExtData(
      recipient,
      extAmount,
      relayer,
      BigNumber.from(fee),
      BigNumber.from(refund),
      wrappedToken,
      '0x' + outputs[0].encrypt(outputs[0].maspKey).toString('hex'),
      '0x' + outputs[1].encrypt(outputs[1].maspKey).toString('hex')
    );

    const roots = await this.populateRootsForProof();

    const publicInputs = await this.publicInputsWithProof(
      roots,
      chainId,
      assetID,
      tokenID,
      inputs,
      outputs,
      feeAssetID,
      feeTokenID,
      whitelistedAssetIds,
      feeInputs,
      feeOutputs,
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
