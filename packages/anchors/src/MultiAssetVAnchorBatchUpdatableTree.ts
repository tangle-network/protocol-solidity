import { MultiAssetVAnchor } from "./MultiAssetVAnchor";
import { MultiAssetVAnchorProxy } from "./MultiAssetVAnchorProxy";
import { MASPVAnchorEncodeInputs__factory, MultiAssetVAnchorTree as MultiAssetVAnchorTreeContract } from "@webb-tools/contracts";
import { MultiAssetVAnchorBatchUpdatableTree as MultiAssetVAnchorBatchUpdatableTreeContract, MultiAssetVAnchorBatchUpdatableTree__factory } from "@webb/contracts";
import { ProxiedBatchTreeUpdater } from "./ProxiedBatchTreeUpdater";
import { ZkComponents } from "@webb-tools/utils";
import { BigNumber, BigNumberish, ethers } from "ethers";

export class MultiAssetVAnchorBatchUpdatableTree extends MultiAssetVAnchor {
    depositTree: ProxiedBatchTreeUpdater;
    unspentTree: ProxiedBatchTreeUpdater;
    spentTree: ProxiedBatchTreeUpdater;

    // Constructor
    constructor(
        contract: MultiAssetVAnchorBatchUpdatableTreeContract,
        levels: number,
        maxEdges: number,
        smallCircuitZkComponents: ZkComponents,
        largeCircuitZkComponents: ZkComponents,
        depositTree: ProxiedBatchTreeUpdater,
        unspentTree: ProxiedBatchTreeUpdater,
        spentTree: ProxiedBatchTreeUpdater,
        signer: ethers.Signer,
    ) {
      super(contract, levels, maxEdges, smallCircuitZkComponents, largeCircuitZkComponents, signer,);

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
        hasher: string,
        handler: string,
        maxEdges: number,
        smallCircuitZkComponents: ZkComponents,
        largeCircuitZkComponents: ZkComponents,
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

        const factory = new MultiAssetVAnchorBatchUpdatableTree__factory(
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
          signer,
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
          signer,
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
          signer,
        );
        const proxy = proxyAddr;

        const maspVAnchorBatchTree = 
        await factory.deploy(
          registry,   
          unspentTree.contract.address,  
          spentTree.contract.address,    
          proxy,  
          verifier,   
          swapVerifier,   
          levels,   
          hasher, 
          handler,    
          depositTree.contract.treeUpdateVerifier(),  
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
            depositTree,
            unspentTree,
            spentTree,
            signer,
        );
        const tx = await createdMASPVAnchorBatchTree.contract.initialize(
            BigNumber.from('1'),
            BigNumber.from(2).pow(256).sub(1)
          );
        await tx.wait();
        return createdMASPVAnchorBatchTree;
    }
  static proxy(registry: string, address: any, address1: any, proxy: any, verifier: string, swapVerifier: string, levels: BigNumberish, hasher: string, handler: string, arg9: any, maxEdges: number, arg11: {}) {
    throw new Error("Method not implemented.");
  }

    // Connect to an existing MultiAssetVAnchorBatchUpdatableTree
}