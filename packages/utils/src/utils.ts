import crypto from 'crypto';
import path from 'path';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { ZkComponents } from './types';

const { poseidon } = require('circomlibjs');
const ffjavascript = require('ffjavascript');
const { leBuff2int } = ffjavascript.utils;

export const poseidonHash = (items: BigNumberish[]) => {
  return BigNumber.from(poseidon(items).toString());
}
export const poseidonHash2 = (a: any, b: any) => {
  return poseidonHash([a, b]);
}

export const FIELD_SIZE = BigNumber.from(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
)

/** Generate random number of specified byte length */
export const randomBN = (nbytes = 31) => BigNumber.from(crypto.randomBytes(nbytes))

export const rbigint = (nbytes: number) => leBuff2int(crypto.randomBytes(nbytes));

export const toHex = (covertThis: ethers.utils.BytesLike | number | bigint, padding: number): string => {
  return ethers.utils.hexZeroPad(ethers.utils.hexlify(covertThis), padding);
};

/** BigNumber to hex string of specified length */
export function toFixedHex(number: BigNumberish, length: number = 32): string {
  let result =
    '0x' +
    (number instanceof Buffer
      ? number.toString('hex')
      : BigNumber.from(number.toString()).toHexString().replace('0x', '')
    ).padStart(length * 2, '0')
  if (result.indexOf('-') > -1) {
    result = '-' + result.replace('-', '')
  }
  return result
}

/** Pad the bigint to 256 bits (32 bytes) */
export function p256(n: bigint) {
  let nstr = BigInt(n).toString(16);
  while (nstr.length < 64) nstr = "0" +nstr;
  nstr = `"0x${nstr}"`;

  return nstr;
}

/** Convert value into buffer of specified byte length */
export const toBuffer = (value: BigNumberish, length: number) =>
  Buffer.from(
    BigNumber.from(value)
      .toHexString()
      .slice(2)
      .padStart(length * 2, '0'),
    'hex',
  )


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

export function getExtDataHash({
  recipient,
  extAmount,
  relayer,
  fee,
  encryptedOutput1,
  encryptedOutput2
}: any) {
  const abi = new ethers.utils.AbiCoder();
  const encodedData = abi.encode(
    ['tuple(address recipient,int256 extAmount,address relayer,uint256 fee,bytes encryptedOutput1,bytes encryptedOutput2)'],
    [{
      recipient: recipient,
      extAmount: extAmount,
      relayer: relayer,
      fee: fee,
      encryptedOutput1: encryptedOutput1,
      encryptedOutput2: encryptedOutput2,
    }],
  );
  const hash = ethers.utils.keccak256(encodedData)
  return BigNumber.from(hash).mod(FIELD_SIZE)
}

export const generateFunctionSigHash = (functionSignature: string): string => {
  return ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(functionSignature)
  ).slice(0, 10).padEnd(10, '0');
}
