import { BigNumberish } from 'ethers';
import { Keypair } from '@webb-tools/sdk-core';

export interface IMerkleProofData {
  pathElements: BigNumberish[];
  pathIndex: BigNumberish;
  merkleRoot: BigNumberish;
}

export interface IUTXOInput {
  chainId: BigNumberish;
  amount: BigNumberish;
  keypair: Keypair;
  blinding: BigNumberish;
  index: number;
}

export interface IVariableAnchorPublicInputs {
  proof: string;
  roots: string;
  extensionRoots: string;
  inputNullifiers: BigNumberish[];
  outputCommitments: [BigNumberish, BigNumberish];
  publicAmount: string;
  extDataHash: BigNumberish;
}

export interface IVariableAnchorExtData {
  recipient: string;
  extAmount: string;
  relayer: string;
  fee: string;
  refund: string;
  token: string;
  encryptedOutput1: string;
  encryptedOutput2: string;
}

export interface IWitnessInput {
  input: {
    roots: BigNumberish[];
    chainID: BigNumberish;
    inputNullifier: BigNumberish[];
    outputCommitment: BigNumberish[];
    publicAmount: BigNumberish;
    extDataHash: BigNumberish;

    // data for 2 transaction inputs
    inAmount: BigNumberish[];
    inPrivateKey: string[];
    inBlinding: BigNumberish[];
    inPathIndices: BigNumberish[];
    inPathElements: BigNumberish[][];

    // data for 2 transaction outputs
    outChainID: BigNumberish[];
    outAmount: BigNumberish[];
    outBlinding: BigNumberish[];
    outPubkey: BigNumberish[];
  };
  extData: IVariableAnchorExtData;
}
