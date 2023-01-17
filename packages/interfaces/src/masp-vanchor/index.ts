import { BigNumber } from "ethers";

export interface IMASPVAnchorPublicInputs {
    proof: string;
    publicAmount: string;
    extDataHash: BigNumber;
    assetID: BigNumber;
    tokenID: BigNumber;
    publicAssetID: BigNumber;
    publicTokenID: BigNumber;
    inputNullifier: BigNumber[];
    outputCommitment: [BigNumber, BigNumber];
    chainID: string;
    roots: string;
    ak_alpha_X: BigNumber[];
    ak_alpha_Y: BigNumber[];
    whitelistedAssetIDs: BigNumber[];
    feeInputNullifier: BigNumber[];
    feeOutputCommitment: BigNumber[];
    fee_ak_alpha_X: BigNumber[];
    fee_ak_alpha_Y: BigNumber[];
}

export type IMASPAllInputs = {
    publicAmount: string;
    extDataHash: BigNumber;
    assetID: BigNumber;
    tokenID: BigNumber;
    publicAssetID: BigNumber;
    publicTokenID: BigNumber;

    // data for transaction inputs
    inputNullifier: BigNumber[];
    inAmount: string[];
    inBlinding: string[];
    inPathIndices: number[];
    inPathElements: BigNumber[][];

    // data for transaction outputs
    outputCommitment: [BigNumber, BigNumber];
    outAmount: string[];
    outChainID: string[];
    outPk_X: string[];
    outPk_Y: string[];
    outBlinding: string[];

    chainID: string;
    roots: string;

    ak_X: BigNumber[];
    ak_Y: BigNumber[];
    sk_alpha: BigNumber[];
    ak_alpha_X: BigNumber[];
    ak_alpha_Y: BigNumber[];

    feeAssetId: BigNumber;
    whitelistedAssetIDs: BigNumber[];
    feeTokenID: BigNumber;

    // data for transaction inputs
    feeInputNullifier: BigNumber[];
    feeInAmount: string[];
    feeInBlinding: string[];
    feeInPathIndices: number[];
    feeInPathElements: BigNumber[][];

    // data for transaction outputs
    feeOutputCommitment: [BigNumber, BigNumber];
    feeOutAmount: string[];
    feeOutChainID: string[];
    feeOutPk_X: string[];
    feeOutPk_Y: string[];
    feeOutBlinding: string[];

    fee_ak_X: BigNumber[];
    fee_ak_Y: BigNumber[];
    fee_sk_alpha: BigNumber[];
    fee_ak_alpha_X: BigNumber[];
    fee_ak_alpha_Y: BigNumber[];
  };
