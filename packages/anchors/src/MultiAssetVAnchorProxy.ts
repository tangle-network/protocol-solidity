import { BigNumber, ethers } from 'ethers';
import { MultiAssetVAnchorProxy as MultiAssetVAnchorProxyContract, MultiAssetVAnchorProxy__factory } from '@webb-tools/contracts';

import { MultiAssetVAnchorBatchTree as MultiAssetVAnchorBatchTreeContract, MultiAssetVAnchorBatchTree__factory } from '@webb-tools/contracts';

import { MultiAssetVAnchorBatchUpdatableTree } from './MultiAssetVAnchorBatchUpdatableTree';

import { QueueDepositInfo } from '@webb-tools/interfaces';

export class MultiAssetVAnchorProxy {
  contract: MultiAssetVAnchorProxyContract;

  // Constructor
  constructor(contract: MultiAssetVAnchorProxyContract) {
    this.contract = contract;
  }

  // Deploy a new MultiAssetVAnchorProxy
  public static async createMultiAssetVAnchorProxy(
    hasher: string,
    deployer: ethers.Signer
  ) {
    const factory = new MultiAssetVAnchorProxy__factory(deployer);
    const contract = await factory.deploy(hasher);
    await contract.deployed();

    const proxy = new MultiAssetVAnchorProxy(contract);
    return proxy;
  }

  // Initialize proxy with the addresses of a MultiAssetVAnchor contracts
  public async initialize(validMASPs: MultiAssetVAnchorBatchTreeContract[]) {
    await this.contract.initialize(validMASPs.map((m) => m.address));
  }

  // Queue ERC20 deposits
  public async queueERC20Deposit(depositInfo: QueueDepositInfo) {
    await this.contract.queueERC20Deposit(
      depositInfo
    );
  }

  // Queue ERC721 deposits
  public async queueERC721Deposit(depositInfo: QueueDepositInfo) {
    await this.contract.queueERC721Deposit(
      depositInfo
    );
  }

  // Queue reward unspent tree commitments
  public async queueRewardUnspentCommitment(masp: string, commitment: string) {
    await this.contract.queueRewardUnspentTreeCommitment(
      masp,
      commitment
    );
  }

  // Queue reward spent tree commitments
  public async queueRewardSpentCommitment(commitment: string) {
    await this.contract.queueRewardSpentTreeCommitment(
      commitment,
    );
  }

  // Batch insert ERC20 deposits
  public async batchDepositERC20s(		
    masp: MultiAssetVAnchorBatchUpdatableTree,
		startQueueIndex: BigNumber,
    batchHeight: BigNumber,
  ) {
    const batchSize = BigNumber.from(2).pow(batchHeight);
    const batchProofInfo = await masp.depositTree.generateProof(
      batchSize.toNumber(),
      await this.getQueuedERC20Deposits(masp.contract.address, startQueueIndex, batchSize),
    );

    await this.contract.batchDepositERC20s(
      masp,
      batchProofInfo.proof,
      batchProofInfo.input.argsHash,
      batchProofInfo.input.oldRoot,
      batchProofInfo.input.newRoot,
      batchProofInfo.input.pathIndices,
      batchHeight,
    );
  }

  // Batch insert ERC721 deposits
  public async batchDepositERC721s(		
    masp: MultiAssetVAnchorBatchUpdatableTree,
    startQueueIndex: BigNumber,
    batchHeight: BigNumber,
  ) {
    const batchSize = BigNumber.from(2).pow(batchHeight);
    const batchProofInfo = await masp.depositTree.generateProof(
      batchSize.toNumber(),
      await this.getQueuedERC721Deposits(masp.contract.address, startQueueIndex, batchSize),
    );

    await this.contract.batchDepositERC721s(
      masp,
      batchProofInfo.proof,
      batchProofInfo.input.argsHash,
      batchProofInfo.input.oldRoot,
      batchProofInfo.input.newRoot,
      batchProofInfo.input.pathIndices,
      batchHeight,
    );
  }

  // Batch insert reward unspent tree commitments
  public async batchInsertRewardUnspentTree(		
    masp: MultiAssetVAnchorBatchUpdatableTree,
    startQueueIndex: BigNumber,
    batchHeight: BigNumber,
  ) {
    const batchSize = BigNumber.from(2).pow(batchHeight);
    const batchProofInfo = await masp.unspentTree.generateProof(
      batchSize.toNumber(),
      await this.getQueuedRewardUnspentCommitments(masp.contract.address,startQueueIndex, batchSize),
    );

    await this.contract.batchInsertRewardUnspentTree(
      masp,
      batchProofInfo.proof,
      batchProofInfo.input.argsHash,
      batchProofInfo.input.oldRoot,
      batchProofInfo.input.newRoot,
      batchProofInfo.input.pathIndices,
      batchHeight,
    );
  }

  // Batch insert reward spent tree commitments
  public async batchInsertRewardSpentTree(		
    masp: MultiAssetVAnchorBatchUpdatableTree,
    startQueueIndex: BigNumber,
    batchHeight: BigNumber,
  ) {
    const batchSize = BigNumber.from(2).pow(batchHeight);
    const batchProofInfo = await masp.spentTree.generateProof(
      batchSize.toNumber(),
      await this.getQueuedRewardSpentCommitments(masp.contract.address, startQueueIndex, batchSize),
    );

    await this.contract.batchInsertRewardSpentTree(
      masp,
      batchProofInfo.proof,
      batchProofInfo.input.argsHash,
      batchProofInfo.input.oldRoot,
      batchProofInfo.input.newRoot,
      batchProofInfo.input.pathIndices,
      batchHeight,
    );
  }

  // Utility Classes *****

  // Get queued ERC20 deposits
  public async getQueuedERC20Deposits(maspAddr: string, startIndex: BigNumber, batchSize: BigNumber): Promise<string[]> {
    const nextIndex = await this.contract.nextQueueERC20DepositIndex[maspAddr];
    const endIndex = startIndex.add(batchSize);
    const deposits = [];
    for (let i = startIndex; i.lt(endIndex); i = i.add(1)) {
      if (i.gte(nextIndex)) {
        break;
      }
      deposits.push(await this.contract.QueueERC20DepositMap[maspAddr][i]);
    }
    return deposits;
  }

  // Get queued ERC721 deposits
  public async getQueuedERC721Deposits(maspAddr: string, startIndex: BigNumber, batchSize: BigNumber): Promise<string[]> {
    const nextIndex = await this.contract.nextQueueERC721DepositIndex[maspAddr];
    const endIndex = startIndex.add(batchSize);
    const deposits = [];
    for (let i = startIndex; i.lt(endIndex); i = i.add(1)) {
      if (i.gte(nextIndex)) {
        break;
      }
      deposits.push(await this.contract.QueueERC721DepositMap[maspAddr][i]);
    }
    return deposits;
  }

  // Get queued reward unspent tree commitments
  public async getQueuedRewardUnspentCommitments(maspAddr: string, startIndex: BigNumber, batchSize: BigNumber): Promise<string[]> {
    const nextIndex = await this.contract.nextQueueRewardUnspentCommitmentIndex[maspAddr];
    const endIndex = startIndex.add(batchSize);
    const commitments = [];
    for (let i = startIndex; i.lt(endIndex); i = i.add(1)) {
      if (i.gte(nextIndex)) {
        break;
      }
      commitments.push(await this.contract.RewardUnspentTreeCommitmentMap[maspAddr][i]);
    }
    return commitments;
  }

  // Get queued reward spent tree commitments
  public async getQueuedRewardSpentCommitments(maspAddr: string, startIndex: BigNumber, batchSize: BigNumber): Promise<string[]> {
    const nextIndex = await this.contract.nextQueueRewardSpentCommitmentIndex[maspAddr];
    const endIndex = startIndex.add(batchSize);
    const commitments = [];
    for (let i = startIndex; i.lt(endIndex); i = i.add(1)) {
      if (i.gte(nextIndex)) {
        break;
      }
      commitments.push(await this.contract.RewardSpentTreeCommitmentMap[maspAddr][i]);
    }
    return commitments;
  }
}

