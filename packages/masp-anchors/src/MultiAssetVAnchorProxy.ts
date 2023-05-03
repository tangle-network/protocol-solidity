import { BigNumber, ethers } from 'ethers';
import {
  MultiAssetVAnchorProxy as MultiAssetVAnchorProxyContract,
  MultiAssetVAnchorBatchTree as MultiAssetVAnchorBatchTreeContract,
  MultiAssetVAnchorProxy__factory,
} from '@webb-tools/masp-anchor-contracts';

import { MultiAssetVAnchorBatchTree } from './MultiAssetVAnchorBatchTree';
import { QueueDepositInfo } from '@webb-tools/interfaces';
import { toFixedHex } from '@webb-tools/sdk-core';

export class MultiAssetVAnchorProxy {
  contract: MultiAssetVAnchorProxyContract;

  // Constructor
  constructor(contract: MultiAssetVAnchorProxyContract) {
    this.contract = contract;
  }

  // Deploy a new MultiAssetVAnchorProxy
  public static async createMultiAssetVAnchorProxy(hasher: string, deployer: ethers.Signer) {
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
  public async queueDeposit(depositInfo: QueueDepositInfo) {
    const tx = await this.contract.queueDeposit(depositInfo);
    await tx.wait();
  }

  // Queue reward unspent tree commitments
  public async queueRewardUnspentCommitment(masp: string, commitment: string) {
    const tx = await this.contract.queueRewardUnspentTreeCommitment(masp, commitment);
    await tx.wait();
  }

  // Queue reward spent tree commitments
  public async queueRewardSpentCommitment(commitment: string) {
    const tx = await this.contract.queueRewardSpentTreeCommitment(commitment);
    await tx.wait();
  }

  // Batch insert ERC20 deposits
  public async batchInsertDeposits(
    masp: MultiAssetVAnchorBatchTree,
    startQueueIndex: BigNumber,
    batchHeight: BigNumber
  ) {
    const batchSize = BigNumber.from(2).pow(batchHeight);
    const leaves = (
      await this.getQueuedDeposits(masp.contract.address, startQueueIndex, batchSize)
    ).map((x) => x.commitment.toString());
    const batchProofInfo = await masp.depositTree.generateProof(batchSize.toNumber(), leaves);
    const batchTx = await this.contract.batchInsertDeposits(
      masp.contract.address,
      batchProofInfo.proof,
      toFixedHex(BigNumber.from(batchProofInfo.input.argsHash!), 32),
      toFixedHex(BigNumber.from(batchProofInfo.input.oldRoot), 32),
      toFixedHex(BigNumber.from(batchProofInfo.input.newRoot), 32),
      batchProofInfo.input.pathIndices,
      batchHeight
    );

    await batchTx.wait();
  }

  // Batch insert reward unspent tree commitments
  public async batchInsertRewardUnspentTree(
    masp: MultiAssetVAnchorBatchTree,
    startQueueIndex: BigNumber,
    batchHeight: BigNumber
  ) {
    const batchSize = BigNumber.from(2).pow(batchHeight);
    const batchProofInfo = await masp.unspentTree.generateProof(
      batchSize.toNumber(),
      await this.getQueuedRewardUnspentCommitments(
        masp.contract.address,
        startQueueIndex,
        batchSize
      )
    );

    await this.contract.batchInsertRewardUnspentTree(
      masp.contract.address,
      batchProofInfo.proof,
      toFixedHex(BigNumber.from(batchProofInfo.input.argsHash!), 32),
      toFixedHex(BigNumber.from(batchProofInfo.input.oldRoot), 32),
      toFixedHex(BigNumber.from(batchProofInfo.input.newRoot), 32),
      batchProofInfo.input.pathIndices,
      batchHeight
    );
  }

  // Batch insert reward spent tree commitments
  public async batchInsertRewardSpentTree(
    masp: MultiAssetVAnchorBatchTree,
    startQueueIndex: BigNumber,
    batchHeight: BigNumber
  ) {
    const batchSize = BigNumber.from(2).pow(batchHeight);
    const batchProofInfo = await masp.spentTree.generateProof(
      batchSize.toNumber(),
      await this.getQueuedRewardSpentCommitments(masp.contract.address, startQueueIndex, batchSize)
    );

    await this.contract.batchInsertRewardSpentTree(
      masp.contract.address,
      batchProofInfo.proof,
      toFixedHex(BigNumber.from(batchProofInfo.input.argsHash!), 32),
      toFixedHex(BigNumber.from(batchProofInfo.input.oldRoot), 32),
      toFixedHex(BigNumber.from(batchProofInfo.input.newRoot), 32),
      batchProofInfo.input.pathIndices,
      batchHeight
    );
  }

  // Utility Classes *****

  // Get queued ERC20 deposits
  public async getQueuedDeposits(
    maspAddr: string,
    startIndex: BigNumber,
    batchSize: BigNumber
  ): Promise<QueueDepositInfo[]> {
    const nextIndex = await this.contract.nextQueueDepositIndex(maspAddr);
    const endIndex = startIndex.add(batchSize);
    const deposits = [];
    for (let i = startIndex; i.lt(endIndex); i = i.add(1)) {
      if (i.gte(nextIndex)) {
        break;
      }
      deposits.push(await this.contract.QueueDepositMap(maspAddr, i));
    }
    return deposits;
  }

  // Get queued reward unspent tree commitments
  public async getQueuedRewardUnspentCommitments(
    maspAddr: string,
    startIndex: BigNumber,
    batchSize: BigNumber
  ): Promise<string[]> {
    const nextIndex = await this.contract.nextRewardUnspentTreeCommitmentIndex(maspAddr);
    const endIndex = startIndex.add(batchSize);
    const commitments = [];
    for (let i = startIndex; i.lt(endIndex); i = i.add(1)) {
      if (i.gte(nextIndex)) {
        break;
      }
      commitments.push(await this.contract.RewardUnspentTreeCommitmentMap(maspAddr, i));
    }
    return commitments;
  }

  // Get queued reward spent tree commitments
  public async getQueuedRewardSpentCommitments(
    maspAddr: string,
    startIndex: BigNumber,
    batchSize: BigNumber
  ): Promise<string[]> {
    const nextIndex = await this.contract.nextRewardSpentTreeCommitmentIndex(maspAddr);
    const endIndex = startIndex.add(batchSize);
    const commitments = [];
    for (let i = startIndex; i.lt(endIndex); i = i.add(1)) {
      if (i.gte(nextIndex)) {
        break;
      }
      commitments.push(await this.contract.RewardSpentTreeCommitmentMap(maspAddr, i));
    }
    return commitments;
  }
}
