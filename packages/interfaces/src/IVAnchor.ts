import { MerkleProof, Utxo } from '@webb-tools/sdk-core';
import { ethers, BaseContract } from 'ethers';

export interface IVAnchor<A extends BaseContract> {
  signer: ethers.Signer;
  contract: A;
  latestSyncedBlock: number;
  token?: string;

  setSigner(signer: ethers.Signer);

  getToken(): Promise<string>;
  getContract(): Promise<string>;

  getProposalData(resourceID: string, leafIndex?: number): Promise<string>;
  getHandler(): Promise<string>;
  getHandlerProposalData(newHandler: string): Promise<string>;
  getAddress(): string;
  getMinWithdrawalLimitProposalData(_minimalWithdrawalAmount: string): Promise<string>;
  getMaxDepositLimitProposalData(_maximumDepositAmount: string): Promise<string>;
  createResourceId(): Promise<string>;
  update(blockNumber?: number): Promise<void>;

  // VAnchor methods
  getMerkleProof(input: Utxo, leavesMap?: Uint8Array[]): MerkleProof;
}
