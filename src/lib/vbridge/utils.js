"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shuffle = exports.toBuffer = exports.toFixedHex = exports.getExtDataHash = exports.randomBN = exports.FIELD_SIZE = exports.poseidonHash2 = exports.poseidonHash = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ethers_1 = require("ethers");
// import { poseidon } from 'circomlibjs';
const { poseidon } = require('circomlibjs');
const poseidonHash = (items) => {
    return ethers_1.BigNumber.from(poseidon(items).toString());
};
exports.poseidonHash = poseidonHash;
const poseidonHash2 = (a, b) => {
    return (0, exports.poseidonHash)([a, b]);
};
exports.poseidonHash2 = poseidonHash2;
exports.FIELD_SIZE = ethers_1.BigNumber.from('21888242871839275222246405745257275088548364400416034343698204186575808495617');
/** Generate random number of specified byte length */
const randomBN = (nbytes = 31) => ethers_1.BigNumber.from(crypto_1.default.randomBytes(nbytes));
exports.randomBN = randomBN;
function getExtDataHash({ recipient, extAmount, relayer, fee, encryptedOutput1, encryptedOutput2 }) {
    const abi = new ethers_1.ethers.utils.AbiCoder();
    const encodedData = abi.encode([
        'tuple(address recipient,int256 extAmount,address relayer,uint256 fee,bytes encryptedOutput1,bytes encryptedOutput2)',
    ], [
        {
            recipient: toFixedHex(recipient, 20),
            extAmount: toFixedHex(extAmount),
            relayer: toFixedHex(relayer, 20),
            fee: toFixedHex(fee),
            encryptedOutput1: encryptedOutput1,
            encryptedOutput2: encryptedOutput2,
        },
    ]);
    const hash = ethers_1.ethers.utils.keccak256(encodedData);
    return ethers_1.BigNumber.from(hash).mod(exports.FIELD_SIZE);
}
exports.getExtDataHash = getExtDataHash;
/** BigNumber to hex string of specified length */
function toFixedHex(number, length = 32) {
    let result = '0x' +
        (number instanceof Buffer
            ? number.toString('hex')
            : ethers_1.BigNumber.from(number).toHexString().replace('0x', '')).padStart(length * 2, '0');
    if (result.indexOf('-') > -1) {
        result = '-' + result.replace('-', '');
    }
    return result;
}
exports.toFixedHex = toFixedHex;
/** Convert value into buffer of specified byte length */
const toBuffer = (value, length) => Buffer.from(ethers_1.BigNumber.from(value)
    .toHexString()
    .slice(2)
    .padStart(length * 2, '0'), 'hex');
exports.toBuffer = toBuffer;
function shuffle(array) {
    let currentIndex = array.length;
    let randomIndex;
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}
exports.shuffle = shuffle;
// export async function getSignerFromAddress(address) {
//   await network.provider.request({
//     method: 'hardhat_impersonateAccount',
//     params: [address],
//   })
//   return await ethers.provider.getSigner(address)
// }
//# sourceMappingURL=utils.js.map