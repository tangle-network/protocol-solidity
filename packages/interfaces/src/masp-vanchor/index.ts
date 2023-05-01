import { BigNumber, BigNumberish } from 'ethers';

export enum AssetType {
  ERC20,
  ERC721,
}

export interface QueueDepositInfo {
  assetType: AssetType;
  unwrappedToken: string;
  wrappedToken: string;
  amount: BigNumberish;
  assetID: BigNumberish;
  tokenID: BigNumberish;
  depositPartialCommitment: string;
  commitment: string;
  isShielded: boolean;
  proxiedMASP: string;
}

export interface IMASPVAnchorPublicInputs {
  proof: BigNumberish;
  publicAmount: BigNumberish;
  extDataHash: BigNumberish;
  publicAssetID: BigNumberish;
  publicTokenID: BigNumberish;
  inputNullifier: BigNumberish[];
  outputCommitment: BigNumberish[];
  chainID: BigNumberish;
  roots: BigNumberish[];
  extensionRoots: BigNumberish;
  whitelistedAssetIDs: BigNumberish[];
  feeInputNullifier: BigNumberish[];
  feeOutputCommitment: BigNumberish[];
}

export type IMASPAllInputs = {
  publicAmount: BigNumberish;
  extDataHash: BigNumberish;
  assetID: BigNumberish;
  tokenID: BigNumberish;
  publicAssetID: BigNumberish;
  publicTokenID: BigNumberish;

  // data for transaction inputs
  inputNullifier: BigNumberish[];
  inAmount: BigNumberish[];
  inBlinding: BigNumberish[];
  inPathIndices: BigNumberish[];
  inPathElements: BigNumber[][];
  inSignature: BigNumberish;
  inR8x: BigNumberish;
  inR8y: BigNumberish;

  // data for transaction outputs
  outputCommitment: BigNumberish[];
  outAmount: BigNumberish[];
  outChainID: BigNumberish[];
  outPk_X: BigNumberish[];
  outPk_Y: BigNumberish[];
  outBlinding: BigNumberish[];
  outSignature: BigNumberish;
  outR8x: BigNumberish;
  outR8y: BigNumberish[];

  chainID: BigNumberish;
  roots: BigNumberish[];

  ak_X: BigNumberish;
  ak_Y: BigNumberish;

  feeAssetID: BigNumberish;
  whitelistedAssetIDs: BigNumberish[];
  feeTokenID: BigNumberish;

  // data for transaction inputs
  feeInputNullifier: BigNumberish[];
  feeInAmount: BigNumberish[];
  feeInBlinding: BigNumberish[];
  feeInPathIndices: BigNumberish[];
  feeInPathElements: BigNumber[][];
  feeInSignature: BigNumberish;
  feeInR8x: BigNumberish;
  feeInR8y: BigNumberish;

  // data for transaction outputs
  feeOutputCommitment: BigNumberish[];
  feeOutAmount: BigNumberish[];
  feeOutChainID: BigNumberish[];
  feeOutPk_X: BigNumberish[];
  feeOutPk_Y: BigNumberish[];
  feeOutBlinding: BigNumberish[];
  feeOutSignature: BigNumberish;
  feeOutR8x: BigNumberish;
  feeOutR8y: BigNumberish[];

  fee_ak_X: BigNumberish;
  fee_ak_Y: BigNumberish;
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
