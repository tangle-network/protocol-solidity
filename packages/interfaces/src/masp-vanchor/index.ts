import { BigNumber } from "ethers";

export interface IMASPVAnchorPublicInputs {
    proof: string;
    roots: string;
    extensionRoots: string;
    inputNullifiers: BigNumber[];
    outputCommitments: [BigNumber, BigNumber];
    publicAmount: string;
    publicAssetId: string;
    publicTokenId: string;
    extDataHash: BigNumber;
}

export type IMASPAllInputs = {
    roots: string[];
    chainID: string;
    inputNullifier: string[];
    outputCommitment: string[];
    publicAmount: string;
    assetID: number,
    tokenID: number,
    publicAssetID: number,
    publicTokenID: number,
    extDataHash: string;
  
    // data for 2 transaction inputs
    inAmount: string[];
    inPrivateKey: string[];
    inBlinding: string[];
    inPathIndices: number[];
    inPathElements: BigNumber[][];
  
    // data for 2 transaction outputs
    outChainID: string[];
    outAmount: string[];
    outPubkey: string[];
    outBlinding: string[];
  };
