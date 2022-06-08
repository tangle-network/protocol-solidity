import path from 'path';
import { BigNumber, BigNumberish } from 'ethers';
import { ZkComponents } from './types';
import { toFixedHex } from '@webb-tools/sdk-core';

const { poseidon } = require('circomlibjs');

export const poseidonHash = (items: BigNumberish[]) => {
  return BigNumber.from(poseidon(items).toString());
}

export async function fetchComponentsFromFilePaths(wasmPath: string, witnessCalculatorPath: string, zkeyPath: string): Promise<ZkComponents> {
  const wasm: Buffer = require('fs').readFileSync(path.resolve(__dirname, wasmPath));
  const witnessCalculatorGenerator = require(witnessCalculatorPath);
  const witnessCalculator = await witnessCalculatorGenerator(wasm);
  const zkeyBuffer: Buffer = require('fs').readFileSync(path.resolve(__dirname, zkeyPath));
  const zkey: Uint8Array = new Uint8Array(zkeyBuffer.buffer.slice(zkeyBuffer.byteOffset, zkeyBuffer.byteOffset + zkeyBuffer.byteLength));

  return {
    wasm,
    witnessCalculator,
    zkey
  };
}

/**
 * Computes the updated chain ID with chain type.
 * @param chainID Chain ID to encode into augmented chain ID Type, defaults to hardhat's chain ID.
 * @returns 
 */
export const getChainIdType = (chainID: number = 31337): number => {
  const CHAIN_TYPE = '0x0100';
  const chainIdType = CHAIN_TYPE + toFixedHex(chainID, 4).substr(2);
  return Number(BigInt(chainIdType));
}
