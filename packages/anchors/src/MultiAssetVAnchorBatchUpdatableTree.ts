import { MultiAssetVAnchor } from "./MultiAssetVAnchor";
import { MultiAssetVAnchorProxy } from "./MultiAssetVAnchorProxy";
import { MultiAssetVAnchorTree as MultiAssetVAnchorTreeContract } from "@webb-tools/contracts";
import { MultiAssetVAnchorBatchUpdatableTree as MultiAssetVAnchorBatchUpdatableTreeContract, MultiAssetVAnchorBatchUpdatableTree__factory } from "@webb/contracts";
import { ProxiedBatchMerkleTree } from "packages/contracts/typechain";
import { ZkComponents } from "@webb-tools/utils";
import { ethers } from "ethers";

export class MultiAssetVAnchorBatchUpdatableTree extends MultiAssetVAnchor {
    smallCircuitZkComponents: ZkComponents;
    largeCircuitZkComponents: ZkComponents;

    unspentTree: ProxiedBatchMerkleTree;
    spentTree: ProxiedBatchMerkleTree;
    depositTree: ProxiedBatchMerkleTree;

    // Constructor
    constructor(
        contract: MultiAssetVAnchorTreeContract,
        signer: ethers.Signer,
        treeHeight: number,
        maxEdges: number,
        smallCircuitZkComponents: ZkComponents,
        largeCircuitZkComponents: ZkComponents
    ) {
        super(contract, signer, treeHeight, maxEdges, smallCircuitZkComponents, largeCircuitZkComponents);
    }

    // Create a new MultiAssetVAnchorBatchUpdatableTree

    // Connect to an existing MultiAssetVAnchorBatchUpdatableTree

}