"use strict";
exports.__esModule = true;
exports.p256 = exports.toFixedHex = exports.toHex = exports.rbigint = void 0;
var crypto = require('crypto');
var ethers_1 = require("ethers");
var ffjavascript = require('ffjavascript');
var utils = ffjavascript.utils;
var leBuff2int = utils.leBuff2int, unstringifyBigInts = utils.unstringifyBigInts;
var rbigint = function (nbytes) { return leBuff2int(crypto.randomBytes(nbytes)); };
exports.rbigint = rbigint;
var toHex = function (covertThis, padding) {
    return ethers_1.ethers.utils.hexZeroPad(ethers_1.ethers.utils.hexlify(covertThis), padding);
};
exports.toHex = toHex;
var toFixedHex = function (number, length) {
    if (length === void 0) { length = 32; }
    return '0x' +
        BigInt("" + number)
            .toString(16)
            .padStart(length * 2, '0');
};
exports.toFixedHex = toFixedHex;
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
function p256(n) {
    var nstr = BigInt(n).toString(16);
    while (nstr.length < 64)
        nstr = "0" + nstr;
    nstr = "\"0x" + nstr + "\"";
    return nstr;
}
exports.p256 = p256;
// export const toSolidityInput = (proof: AnchorWithdrawProof, publicSignals: AnchorPublicSignals) => {
//   const result = {
//     pi_a: [proof.pi_a[0], proof.pi_a[1]],
//     pi_b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
//     pi_c: [proof.pi_c[0], proof.pi_c[1]],
//     publicSignals: publicSignals,
//   };
//   return hexifyBigInts(unstringifyBigInts(result));
// }
