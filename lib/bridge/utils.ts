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

const HasherContract = require('../../artifacts/contracts/trees/Poseidon.sol/PoseidonT3.json');
const VerifierContract = require('../../artifacts/contracts/verifiers/bridge/Verifier.sol/Verifier.json');

// Hasher and Verifier ABIs for deployment
export async function getHasherFactory(wallet: ethers.Signer): Promise<ethers.ContractFactory> {
  const hasherContractRaw = {
    contractName: 'PoseidonT3',
    abi: HasherContract.abi,
    bytecode: HasherContract.bytecode,
  };

  const hasherFactory = new ethers.ContractFactory(hasherContractRaw.abi, hasherContractRaw.bytecode, wallet);
  return hasherFactory;
};

export async function getVerifierFactory(wallet: ethers.Signer): Promise<ethers.ContractFactory> {
  const VerifierContractRaw = {
    contractName: 'Verifier',
    abi: VerifierContract.abi,
    bytecode: VerifierContract.bytecode,
  };

  const verifierFactory = new ethers.ContractFactory(VerifierContractRaw.abi, VerifierContractRaw.bytecode, wallet);
  return verifierFactory;
};

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

