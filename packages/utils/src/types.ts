import {BigNumberish} from 'ethers';

export type ZkComponents = {
  wasm: Buffer;
  zkey: Uint8Array;
  witnessCalculator: any;
};

export interface RootInfo {
  merkleRoot: BigNumberish;
  chainId: BigNumberish;
}
