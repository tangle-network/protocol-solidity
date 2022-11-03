import {BigNumberish, BigNumber} from 'ethers';
import {Keypair} from '@webb-tools/sdk-core';

export interface IIdentityVariableAnchorPublicInputs {
  proof: string;
  identityRoots: string;
  vanchorRoots: string;
  inputNullifiers: string[];
  outputCommitments: [string, string];
  publicAmount: string;
  extDataHash: string;
}

export interface IIdentityVariableAnchorExtData {
  recipient: string;
  extAmount: string;
  relayer: string;
  fee: string;
  refund: string;
  token: string;
  encryptedOutput1: string;
  encryptedOutput2: string;
}

export interface IIdentityWitnessInput {
  input: {
    // Semaphore inputs
    privateKey: string;
    semaphorePathIndices: BigNumberish[];
    semaphorePathElements: BigNumberish[][];
    // roots for semaphore interoperability
    semaphoreRoots: BigNumberish[];

    chainID: BigNumberish;

    publicAmount: BigNumberish;
    extDataHash: BigNumberish;

    // data for transaction inputs
    inputNullifier: BigNumberish[];
    inAmount: BigNumberish[];
    inPrivateKey: string[];
    inBlinding: BigNumberish[];
    inPathIndices: BigNumberish[];
    inPathElements: BigNumberish[][];

    // data for 2 transaction outputs
    outputCommitment: BigNumberish[];
    outChainID: BigNumberish[];
    outAmount: BigNumberish[];
    outBlinding: BigNumberish[];
    outPubkey: BigNumberish[];

    // roots for vanchor interoperability
    vanchorRoots: BigNumberish[];
  };
  extData: IIdentityVariableAnchorExtData;
}
