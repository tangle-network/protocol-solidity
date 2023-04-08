import { BigNumber, ethers } from 'ethers';
import {
  MultiAssetVAnchorProxy as MultiAssetVAnchorProxyContract,
  MultiAssetVAnchorProxy__factory,
} from '@webb-tools/contracts';

import { poseidon } from 'circomlibjs';

import {
  MultiAssetVAnchorBatchTree as MultiAssetVAnchorBatchTreeContract,
  MultiAssetVAnchorBatchTree__factory,
} from '@webb-tools/contracts';

import { MultiAssetVAnchorBatchTree } from './MultiAssetVAnchorBatchTree';

import { QueueDepositInfo } from '@webb-tools/interfaces';
import { toFixedHex } from '@webb-tools/sdk-core';
import { MaspUtxo } from '@webb-tools/utils';

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
  public async queueERC20Deposit(depositInfo: QueueDepositInfo) {
    const tx = await this.contract.queueERC20Deposit(depositInfo);
    await tx.wait();
  }

  // Queue ERC721 deposits
  public async queueERC721Deposit(depositInfo: QueueDepositInfo) {
    const tx = await this.contract.queueERC721Deposit(depositInfo);
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
  public async batchDepositERC20s(
    masp: MultiAssetVAnchorBatchTree,
    startQueueIndex: BigNumber,
    batchHeight: BigNumber
  ) {
    const batchSize = BigNumber.from(2).pow(batchHeight);
    const leaves = (await this.getQueuedERC20Deposits(masp.contract.address, startQueueIndex, batchSize)).map(x => toFixedHex(BigNumber.from(poseidon([x.assetID, x.tokenID, x.amount, x.depositPartialCommitment]))));
    const batchProofInfo = await masp.depositTree.generateProof(
      batchSize.toNumber(),
      leaves
    );

    const batchTx = await this.contract.batchDepositERC20s(
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

  // Batch insert ERC721 deposits
  public async batchDepositERC721s(
    masp: MultiAssetVAnchorBatchTree,
    startQueueIndex: BigNumber,
    batchHeight: BigNumber
  ) {
    const batchSize = BigNumber.from(2).pow(batchHeight);
    const leaves = (await this.getQueuedERC721Deposits(masp.contract.address, startQueueIndex, batchSize)).map(x => toFixedHex(BigNumber.from(poseidon([x.assetID, x.tokenID, x.amount, x.depositPartialCommitment]))));
    const batchProofInfo = await masp.depositTree.generateProof(
      batchSize.toNumber(),
      leaves
    );

    await this.contract.batchDepositERC721s(
      masp.contract.address,
      batchProofInfo.proof,
      toFixedHex(BigNumber.from(batchProofInfo.input.argsHash!), 32),
      toFixedHex(BigNumber.from(batchProofInfo.input.oldRoot), 32),
      toFixedHex(BigNumber.from(batchProofInfo.input.newRoot), 32),
      batchProofInfo.input.pathIndices,
      batchHeight
    );
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
      batchProofInfo.input.argsHash!,
      batchProofInfo.input.oldRoot,
      batchProofInfo.input.newRoot,
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
      batchProofInfo.input.argsHash!,
      batchProofInfo.input.oldRoot,
      batchProofInfo.input.newRoot,
      batchProofInfo.input.pathIndices,
      batchHeight
    );
  }

  // Utility Classes *****

  // Get queued ERC20 deposits
  public async getQueuedERC20Deposits(
    maspAddr: string,
    startIndex: BigNumber,
    batchSize: BigNumber
  ): Promise<QueueDepositInfo[]> {
    const nextIndex = await this.contract.nextQueueERC20DepositIndex(maspAddr);
    const endIndex = startIndex.add(batchSize);
    const deposits = [];
    for (let i = startIndex; i.lt(endIndex); i = i.add(1)) {
      if (i.gte(nextIndex)) {
        break;
      }
      deposits.push(await this.contract.QueueERC20DepositMap(maspAddr, i));
    }
    return deposits;
  }

  // Get queued ERC721 deposits
  public async getQueuedERC721Deposits(
    maspAddr: string,
    startIndex: BigNumber,
    batchSize: BigNumber
  ): Promise<QueueDepositInfo[]> {
    const nextIndex = await this.contract.nextQueueERC721DepositIndex(maspAddr);
    const endIndex = startIndex.add(batchSize);
    const deposits = [];
    for (let i = startIndex; i.lt(endIndex); i = i.add(1)) {
      if (i.gte(nextIndex)) {
        break;
      }
      deposits.push(await this.contract.QueueERC721DepositMap(maspAddr, i));
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
