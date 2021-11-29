export interface AnchorDepositInfo {
  chainID: BigInt;
  secret: BigInt;
  nullifier: BigInt;
  commitment: string;
  nullifierHash: string;
};

export interface AnchorDeposit {
  deposit: AnchorDepositInfo;
  index: number;
  originChainId: number;
};

export interface IPublicInputs {
  _roots: string;
  _nullifierHash: string;
  _refreshCommitment: string;
  _recipient: string;
  _relayer: string;
  _fee: string;
  _refund: string;
}
