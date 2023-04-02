import { BigNumber } from 'ethers';

export interface QueueDepositInfo {
  unwrappedToken: string;
  wrappedToken: string;
  amount: BigNumber;
  assetID: BigNumber;
  tokenID: BigNumber;
  depositPartialCommitment: string;
  proxiedMASP: string;
}

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
  alpha: string[];
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
  fee_alpha: string[];
  fee_ak_alpha_X: string[];
  fee_ak_alpha_Y: string[];
};

export type IMASPSwapPublicInputs = {
  proof: string;
  aliceSpendNullifier: string;
  bobSpendNullifier: string;
  swapChainID: string;
  roots: string[];
  currentTimestamp: string;
  aliceChangeRecord: string;
  bobChangeRecord: string;
  aliceReceiveRecord: string;
  bobReceiveRecord: string;
};

export type IMASPSwapAllInputs = {
  aliceSpendAssetID: string;
  aliceSpendTokenID: string;
  aliceSpendAmount: string;
  aliceSpendInnerPartialRecord: string;
  bobSpendAssetID: string;
  bobSpendTokenID: string;
  bobSpendAmount: string;
  bobSpendInnerPartialRecord: string;
  t: string;
  tPrime: string;
  alice_ak_X: string;
  alice_ak_Y: string;
  bob_ak_X: string;
  bob_ak_Y: string;
  alice_R8x: string;
  alice_R8y: string;
  aliceSig: string;
  bob_R8x: string;
  bob_R8y: string;
  bobSig: string;
  aliceSpendPathElements: BigNumber[];
  aliceSpendPathIndices: string;
  aliceSpendNullifier: string;
  bobSpendPathElements: BigNumber[];
  bobSpendPathIndices: string;
  bobSpendNullifier: string;
  swapChainID: string;
  roots: string[];
  currentTimestamp: string;
  aliceChangeChainID: string;
  aliceChangeAssetID: string;
  aliceChangeTokenID: string;
  aliceChangeAmount: string;
  aliceChangeInnerPartialRecord: string;
  aliceChangeRecord: string;
  bobChangeChainID: string;
  bobChangeAssetID: string;
  bobChangeTokenID: string;
  bobChangeAmount: string;
  bobChangeInnerPartialRecord: string;
  bobChangeRecord: string;
  aliceReceiveChainID: string;
  aliceReceiveAssetID: string;
  aliceReceiveTokenID: string;
  aliceReceiveAmount: string;
  aliceReceiveInnerPartialRecord: string;
  aliceReceiveRecord: string;
  bobReceiveChainID: string;
  bobReceiveAssetID: string;
  bobReceiveTokenID: string;
  bobReceiveAmount: string;
  bobReceiveInnerPartialRecord: string;
  bobReceiveRecord: string;
};
