import { VAnchorBase } from '@webb-tools/contracts';
import { MerkleProof, Utxo } from '@webb-tools/sdk-core';
import { ethers } from 'ethers';

export interface IVAnchor {
  signer: ethers.Signer;
  contract: VAnchorBase;
  latestSyncedBlock: number;
  token?: string;
  denomination?: string;

  setSigner(signer: ethers.Signer);
  getProposalData(resourceID: string, leafIndex?: number): Promise<string>;
  getHandler(): Promise<string>;
  getHandlerProposalData(newHandler: string): Promise<string>;
  getAddress(): string;
  getMinWithdrawalLimitProposalData(_minimalWithdrawalAmount: string): Promise<string>;
  getMaxDepositLimitProposalData(_maximumDepositAmount: string): Promise<string>;
  createResourceId(): Promise<string>;
  update(blockNumber?: number): Promise<void>;

  // VAnchor methods
  getMerkleProof(input: Utxo): MerkleProof;
}
