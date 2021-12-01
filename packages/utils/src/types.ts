import { ethers } from "ethers";

export type ZkComponents = {
  wasm: Buffer;
  zkey: Uint8Array;
  witnessCalculator: any;
};

export type Overrides = {
  from?: string,
  gasLimit?: ethers.BigNumberish | Promise<ethers.BigNumberish>,
}
