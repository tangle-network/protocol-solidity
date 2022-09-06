import { IAnchorDeposit, IAnchorDepositInfo } from './anchor';
import { AnchorBase } from '@webb-tools/contracts';
import { MerkleProof, Utxo } from '@webb-tools/sdk-core';
import { BigNumberish, ethers } from 'ethers';

export interface IAnchor {
  signer: ethers.Signer;
  contract: AnchorBase;
  tree: any;
  // hex string of the connected root
  latestSyncedBlock: number;

  // The depositHistory stores leafIndex => information to create proposals (new root)
  depositHistory: Record<number, string>;
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
