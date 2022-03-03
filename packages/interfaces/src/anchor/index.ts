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
  _roots: string;
  _nullifierHash: string;
  _refreshCommitment: string;
  _recipient: string;
  _relayer: string;
  _fee: string;
  _refund: string;
  _extDataHash: string;
}
