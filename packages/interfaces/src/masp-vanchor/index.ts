import { BigNumber } from 'ethers';

export interface IMASPVAnchorPublicInputs {
  proof: string;
  publicAmount: string;
  extDataHash: string;
  publicAssetID: number;
  publicTokenID: number;
  inputNullifier: string[];
  outputCommitment: string[];
  chainID: string;
  roots: string[];
  extensionRoots: string;
  ak_alpha_X: string[];
  ak_alpha_Y: string[];
  whitelistedAssetIDs: number[];
  feeInputNullifier: string[];
  feeOutputCommitment: string[];
  fee_ak_alpha_X: string[];
  fee_ak_alpha_Y: string[];
}

export type IMASPAllInputs = {
  publicAmount: string;
  extDataHash: string;
  assetID: number;
  tokenID: number;
  publicAssetID: number;
  publicTokenID: number;

  // data for transaction inputs
  inputNullifier: string[];
  inAmount: string[];
  inBlinding: string[];
  inPathIndices: number[];
  inPathElements: BigNumber[][];

  // data for transaction outputs
  outputCommitment: string[];
  outAmount: string[];
  outChainID: string[];
  outPk_X: string[];
  outPk_Y: string[];
  outBlinding: string[];

  chainID: string;
  roots: string[];

  ak_X: string[];
  ak_Y: string[];
  sk_alpha: string[];
  ak_alpha_X: string[];
  ak_alpha_Y: string[];

  feeAssetID: number;
  whitelistedAssetIDs: number[];
  feeTokenID: number;

  // data for transaction inputs
  feeInputNullifier: string[];
  feeInAmount: string[];
  feeInBlinding: string[];
  feeInPathIndices: number[];
  feeInPathElements: BigNumber[][];

  // data for transaction outputs
  feeOutputCommitment: string[];
  feeOutAmount: string[];
  feeOutChainID: string[];
  feeOutPk_X: string[];
  feeOutPk_Y: string[];
  feeOutBlinding: string[];

  fee_ak_X: string[];
  fee_ak_Y: string[];
  fee_sk_alpha: string[];
  fee_ak_alpha_X: string[];
  fee_ak_alpha_Y: string[];
};
