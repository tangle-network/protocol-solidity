import { toFixedHex } from '@webb-tools/sdk-core';
import { ZkComponents } from '@webb-tools/utils';
import { BigNumberish, ethers } from 'ethers';
import {
  BatchMerkleTreeMock as BatchMerkleTreeContract,
  BatchMerkleTreeMock__factory,
} from '@webb-tools/masp-anchor-contracts';
import { BatchTreeUpdater } from '@webb-tools/masp-anchors';

const assert = require('assert');

export class BatchTreeUpdaterMock extends BatchTreeUpdater {
  contract: BatchMerkleTreeContract;

  constructor(
    contract: BatchMerkleTreeContract,
    signer: ethers.Signer,
    treeHeight: number,
    zkComponents_4: ZkComponents,
    zkComponents_8: ZkComponents,
    zkComponents_16: ZkComponents,
    zkComponents_32: ZkComponents
  ) {
    super(
      contract,
      signer,
      treeHeight,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32
    );
    this.contract = contract;
  }

  public static async createBatchTreeUpdaterMock(
    verifierAddr: string,
    levels: number,
    hasherAddr: string,
    zkComponents_4: ZkComponents,
    zkComponents_8: ZkComponents,
    zkComponents_16: ZkComponents,
    zkComponents_32: ZkComponents,
    signer: ethers.Signer
  ) {
    const factory = new BatchMerkleTreeMock__factory(signer);
    const contract = await factory.deploy(levels, hasherAddr, verifierAddr);
    await contract.deployed();

    const createdBatchTreeUpdater = new BatchTreeUpdaterMock(
      contract,
      signer,
      levels,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32
    );
    createdBatchTreeUpdater.latestSyncedBlock = contract.deployTransaction.blockNumber!;
    return createdBatchTreeUpdater;
  }

  public async registerInsertion(instance: string, commitment: BigNumberish) {
    return await this.contract.registerInsertion(instance, toFixedHex(commitment));
  }

  public async registerInsertions(instances: string[], commitments: BigNumberish[]) {
    assert(instances.length === commitments.length);
    let transactions = [];
    for (let i = 0; i < instances.length; i++) {
      let tx = await this.contract.registerInsertion(instances[i], toFixedHex(commitments[i]));
      transactions.push(tx);
    }
    return transactions;
  }
}
