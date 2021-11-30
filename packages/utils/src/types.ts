import { ethers } from "ethers";

export type ZkComponents = {
  wasm: Buffer;
  zkey: Uint8Array;
  witnessCalculator: any;
};

export type Overrides = ethers.Overrides & { from?: string | Promise<string> }
