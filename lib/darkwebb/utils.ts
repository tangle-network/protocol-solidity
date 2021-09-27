const crypto = require('crypto');
import { BigNumberish, ethers } from 'ethers';
import { AnchorPublicSignals, AnchorWithdrawProof } from './Anchor';
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

// export const hexifyBigInts = (o: string | number | bigint | object | any[]): string | number | object | any[] => {
//   if (typeof (o) === "bigint") {
//     let str = o.toString(16);
//     while (str.length < 64) str = "0" + str;
//     str = "0x" + str;
//     return str;
//   } else if (Array.isArray(o)) {
//     return o.map(hexifyBigInts);
//   } else if (typeof o == "object") {
//     const res = {};
//     for (let k in o) {
//       res[k] = hexifyBigInts(o[k]);
//     }
//     return res;
//   } else {
//     return o;
//   }
// }

// Pad the bigint to 256 bits (32 bytes)
export function p256(n: bigint) {
  let nstr = BigInt(n).toString(16);
  while (nstr.length < 64) nstr = "0" +nstr;
  nstr = `"0x${nstr}"`;

  return nstr;
}

// export const toSolidityInput = (proof: AnchorWithdrawProof, publicSignals: AnchorPublicSignals) => {
//   const result = {
//     pi_a: [proof.pi_a[0], proof.pi_a[1]],
//     pi_b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
//     pi_c: [proof.pi_c[0], proof.pi_c[1]],
//     publicSignals: publicSignals,
//   };

//   return hexifyBigInts(unstringifyBigInts(result));
// }
