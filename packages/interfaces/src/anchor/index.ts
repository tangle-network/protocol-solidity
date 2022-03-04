export interface IAnchorDepositInfo {
  chainID: BigInt;
  secret: BigInt;
  nullifier: BigInt;
  commitment: string;
  nullifierHash: string;
};

export interface IAnchorDeposit {
  deposit: IAnchorDepositInfo;
  index: number;
  originChainId: number;
};

export interface IFixedAnchorPublicInputs {
  proof: string,
  _roots: string;
  _nullifierHash: string;
  _extDataHash: string;
}

export interface IFixedAnchorExtData {
  _refreshCommitment: string;
  _recipient: string;
  _relayer: string;
  _fee: bigint
  _refund: bigint;
}
