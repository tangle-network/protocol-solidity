import { IVariableAnchorExtData } from '@webb-tools/interfaces';
import { BigNumberish } from 'ethers';

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
  extData: IVariableAnchorExtData;
}
