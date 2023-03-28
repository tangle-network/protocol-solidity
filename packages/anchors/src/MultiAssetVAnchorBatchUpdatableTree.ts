import { MultiAssetVAnchor } from './MultiAssetVAnchor';
import { MultiAssetVAnchorProxy } from './MultiAssetVAnchorProxy';
import {
  MASPVAnchorEncodeInputs__factory,
  MultiAssetVAnchorTree as MultiAssetVAnchorTreeContract,
} from '@webb-tools/contracts';
import {
  MultiAssetVAnchorBatchTree as MultiAssetVAnchorBatchTreeContract,
  MultiAssetVAnchorBatchTree__factory,
} from '@webb-tools/contracts';
import { ProxiedBatchTreeUpdater } from './ProxiedBatchTreeUpdater';
import { ZkComponents } from '@webb-tools/utils';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import {
  ProxiedBatchMerkleTree as ProxiedBatchMerkleTreeContract,
  ProxiedBatchMerkleTree__factory,
} from '@webb-tools/contracts';

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
    depositTree: ProxiedBatchMerkleTreeContract,
    unspentTree: ProxiedBatchMerkleTreeContract,
    spentTree: ProxiedBatchMerkleTreeContract,
    signer: ethers.Signer
  ) {
    super(contract, levels, maxEdges, smallCircuitZkComponents, largeCircuitZkComponents, swapCircuitZkComponents, signer);

    this.depositTree.contract = depositTree;
    this.unspentTree.contract = unspentTree;
    this.spentTree.contract = spentTree;
  }

  // Create a new MultiAssetVAnchorBatchUpdatableTree

  public static async createMASPVAnchorBatchTree(
    registry: string,
    verifier: string,
    swapVerifier: string,
    levels: number,
    hasher: string,
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

    const factory = new MultiAssetVAnchorBatchTree__factory(
      {
        ['contracts/libs/MASPVAnchorEncodeInputs.sol:MASPVAnchorEncodeInputs']:
          encodeLibrary.address,
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
      hasher,
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
      depositTree.contract,
      unspentTree.contract,
      spentTree.contract,
      signer
    );
    const tx = await createdMASPVAnchorBatchTree.contract.initialize(
      BigNumber.from('1'),
      BigNumber.from(2).pow(256).sub(1)
    );
    await tx.wait();
    return createdMASPVAnchorBatchTree;
  }
  static proxy(
    registry: string,
    address: any,
    address1: any,
    proxy: any,
    verifier: string,
    swapVerifier: string,
    levels: BigNumberish,
    hasher: string,
    handler: string,
    arg9: any,
    maxEdges: number,
    arg11: {}
  ) {
    throw new Error('Method not implemented.');
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
    signer: ethers.Signer
  ) {
    const masp = MultiAssetVAnchorBatchTree__factory.connect(address, signer);
    const depositTree = ProxiedBatchMerkleTree__factory.connect(depositTreeAddr, signer);
    const unspentTree = ProxiedBatchMerkleTree__factory.connect(unspentTreeAddr, signer);
    const spentTree = ProxiedBatchMerkleTree__factory.connect(spentTreeAddr, signer);
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
}
