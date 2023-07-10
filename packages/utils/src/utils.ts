import crypto from 'crypto';
import { BigNumber, BigNumberish, BytesLike, ethers } from 'ethers';
import { FIELD_SIZE } from './protocol';

import EC from 'elliptic';

export const median = (arr: number[]): number => {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);

  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
};

export const mean = (arr: number[]) => arr.reduce((p, c) => p + c, 0) / arr.length;
export const max = (arr: number[]) => arr.reduce((a, b) => (a > b ? a : b));
export const min = (arr: number[]) => arr.reduce((a, b) => (a <= b ? a : b));

/** Generate random number of specified byte length */
export const randomBN = (nbytes = 31) => BigNumber.from(crypto.randomBytes(nbytes));

export const randomFieldElement = (nbytes = 32) => {
  const fieldElt = randomBN(nbytes).mod(FIELD_SIZE);
  return Uint8Array.from(Buffer.from(fieldElt.toHexString()));
};

export const toHex = (
  covertThis: ethers.utils.BytesLike | number | bigint,
  padding: number
): string => {
  return ethers.utils.hexZeroPad(ethers.utils.hexlify(covertThis), padding);
};

/** BigNumber to hex string of specified length */
export function toFixedHex(number: BigNumberish, length = 32): string {
  let result =
    '0x' +
    (number instanceof Buffer
      ? number.toString('hex')
      : BigNumber.from(number).toHexString().replace('0x', '')
    ).padStart(length * 2, '0');

  if (result.indexOf('-') > -1) {
    result = '-' + result.replace('-', '');
  }

  return result;
}

/** Pad the bigint to 256 bits (32 bytes) */
export function p256(n: bigint) {
  let nstr = BigInt(n).toString(16);

  while (nstr.length < 64) {
    nstr = '0' + nstr;
  }

  nstr = `"0x${nstr}"`;

  return nstr;
}

/** Convert value into buffer of specified byte length */
export const toBuffer = (value: BigNumberish, length: number) => {
  return Buffer.from(
    BigNumber.from(value)
      .toHexString()
      .slice(2)
      .padStart(length * 2, '0'),
    'hex'
  );
};

/**
 * Computes the updated chain ID with chain type.
 * @param chainID Chain ID to encode into augmented chain ID Type, defaults to hardhat's chain ID.
 * @returns
 */
export const getChainIdType = (chainID: number = 31337): number => {
  const CHAIN_TYPE = '0x0100';
  const chainIdType = CHAIN_TYPE + toFixedHex(chainID, 4).substr(2);
  return Number(BigInt(chainIdType));
};

export const signMessage = (wallet: ethers.Wallet, data: BytesLike) => {
  // eslint-disable-next-line new-cap
  const ec = new EC.ec('secp256k1');
  const key = ec.keyFromPrivate(wallet.privateKey.slice(2), 'hex');
  const hash = ethers.utils.keccak256(data);
  const hashedData = ethers.utils.arrayify(hash);
  const signature = key.sign(hashedData);
  const expandedSig = {
    r: '0x' + signature.r.toString('hex'),
    s: '0x' + signature.s.toString('hex'),
    v: signature.recoveryParam + 27,
  };
  let sig;

  // Transaction malleability fix if s is too large (Bitcoin allows it, Ethereum rejects it)
  try {
    sig = ethers.utils.joinSignature(expandedSig);
  } catch (e) {
    expandedSig.s = BigNumber.from('0x' + ec.curve.n.toString('hex'))
      .sub(BigNumber.from(expandedSig.s))
      .toHexString();
    expandedSig.v = expandedSig.v === 27 ? 28 : 27;
    sig = ethers.utils.joinSignature(expandedSig);
  }

  return sig;
};
