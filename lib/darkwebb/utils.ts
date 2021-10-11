const crypto = require('crypto');
import { BigNumberish, ethers } from 'ethers';
const ffjavascript = require('ffjavascript');
const utils = ffjavascript.utils;
const {
  leBuff2int,
  unstringifyBigInts
} = utils;

export const rbigint = (nbytes: number) => leBuff2int(crypto.randomBytes(nbytes));

export const toHex = (covertThis: ethers.utils.BytesLike, padding: number): string => {
  return ethers.utils.hexZeroPad(ethers.utils.hexlify(covertThis), padding);
};

export const toFixedHex = (number: string | bigint | number, length: number = 32): string =>
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
