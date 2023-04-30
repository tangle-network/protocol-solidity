import { BigNumberish } from 'ethers';

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
