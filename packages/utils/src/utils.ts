const crypto = require('crypto');
import { BigNumberish, ethers } from 'ethers';
import { ZkComponents } from './types';
const path = require('path');
const ffjavascript = require('ffjavascript');
const utils = ffjavascript.utils;
const {
  leBuff2int,
  unstringifyBigInts
} = utils;

export const rbigint = (nbytes: number) => leBuff2int(crypto.randomBytes(nbytes));

export const toHex = (covertThis: ethers.utils.BytesLike | number | bigint, padding: number): string => {
  return ethers.utils.hexZeroPad(ethers.utils.hexlify(covertThis), padding);
};

export const toFixedHex = (number: BigNumberish, length: number = 32): string =>
  '0x' +
  BigInt(`${number}`)
    .toString(16)
    .padStart(length * 2, '0');

// Pad the bigint to 256 bits (32 bytes)
export function p256(n: bigint) {
  let nstr = BigInt(n).toString(16);
  while (nstr.length < 64) nstr = "0" +nstr;
  nstr = `"0x${nstr}"`;

  return nstr;
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

