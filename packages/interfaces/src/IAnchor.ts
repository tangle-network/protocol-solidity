import { IAnchorDeposit, IAnchorDepositInfo } from './anchor';
import { IMerkleProofData } from './vanchor';
import { Utxo } from "@webb-tools/utils";
import { BigNumberish, ethers } from 'ethers';

export interface IAnchor {
  signer: ethers.Signer;
  contract: ethers.Contract;
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
  
  // FixedDepositAnchor methods
  deposit(destinationChainId: number): Promise<IAnchorDeposit>;
  setupWithdraw(
    deposit: IAnchorDepositInfo,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string | number,
  );
  withdraw(
    deposit: IAnchorDepositInfo,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string | number,
  ): Promise<ethers.Event>
  wrapAndDeposit(tokenAddress: string, wrappingFee: number, destinationChainId?: number): Promise<IAnchorDeposit>;
  bridgedWithdrawAndUnwrap(
    deposit: IAnchorDeposit,
    merkleProof: any,
    recipient: string,
    relayer: string,
    fee: string,
    refund: string,
    refreshCommitment: string,
    tokenAddress: string,
  ): Promise<ethers.Event>
  bridgedWithdraw(
    deposit: IAnchorDeposit,
    merkleProof: any,
    recipient: string,
    relayer: string,
    fee: string,
    refund: string,
    refreshCommitment: string,
  ): Promise<ethers.Event>

  // VAnchor methods
  bridgedTransactWrap(
    tokenAddress: string,
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    recipient: string,
    relayer: string,
    merkleProofsForInputs: any[]
  ): Promise<ethers.ContractReceipt>;
  getMerkleProof(input: Utxo): IMerkleProofData;
  bridgedTransact(
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    recipient: string,
    relayer: string,
    merkleProofsForInputs: any[]
  ): Promise<ethers.ContractReceipt>;
}