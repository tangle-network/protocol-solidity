"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchComponentsFromFilePaths = exports.getVerifierFactory = exports.getHasherFactory = exports.p256 = exports.toFixedHex = exports.toHex = exports.rbigint = void 0;
const crypto = require('crypto');
const ethers_1 = require("ethers");
const path = require('path');
const ffjavascript = require('ffjavascript');
const utils = ffjavascript.utils;
const { leBuff2int, unstringifyBigInts } = utils;
const rbigint = (nbytes) => leBuff2int(crypto.randomBytes(nbytes));
exports.rbigint = rbigint;
const toHex = (covertThis, padding) => {
    return ethers_1.ethers.utils.hexZeroPad(ethers_1.ethers.utils.hexlify(covertThis), padding);
};
exports.toHex = toHex;
const toFixedHex = (number, length = 32) => '0x' +
    BigInt(`${number}`)
        .toString(16)
        .padStart(length * 2, '0');
exports.toFixedHex = toFixedHex;
// Pad the bigint to 256 bits (32 bytes)
function p256(n) {
    let nstr = BigInt(n).toString(16);
    while (nstr.length < 64)
        nstr = "0" + nstr;
    nstr = `"0x${nstr}"`;
    return nstr;
}
exports.p256 = p256;
const HasherContract = require('../../artifacts/contracts/trees/Poseidon.sol/PoseidonT3.json');
const VerifierContract = require('../../artifacts/contracts/verifiers/bridge/Verifier.sol/Verifier.json');
// Hasher and Verifier ABIs for deployment
async function getHasherFactory(wallet) {
    const hasherContractRaw = {
        contractName: 'PoseidonT3',
        abi: HasherContract.abi,
        bytecode: HasherContract.bytecode,
    };
    const hasherFactory = new ethers_1.ethers.ContractFactory(hasherContractRaw.abi, hasherContractRaw.bytecode, wallet);
    return hasherFactory;
}
exports.getHasherFactory = getHasherFactory;
;
async function getVerifierFactory(wallet) {
    const VerifierContractRaw = {
        contractName: 'Verifier',
        abi: VerifierContract.abi,
        bytecode: VerifierContract.bytecode,
    };
    const verifierFactory = new ethers_1.ethers.ContractFactory(VerifierContractRaw.abi, VerifierContractRaw.bytecode, wallet);
    return verifierFactory;
}
exports.getVerifierFactory = getVerifierFactory;
;
async function fetchComponentsFromFilePaths(wasmPath, witnessCalculatorPath, zkeyPath) {
    const wasm = require('fs').readFileSync(path.resolve(__dirname, wasmPath));
    const witnessCalculatorGenerator = require(witnessCalculatorPath);
    const witnessCalculator = await witnessCalculatorGenerator(wasm);
    const zkeyBuffer = require('fs').readFileSync(path.resolve(__dirname, zkeyPath));
    const zkey = new Uint8Array(zkeyBuffer.buffer.slice(zkeyBuffer.byteOffset, zkeyBuffer.byteOffset + zkeyBuffer.byteLength));
    return {
        wasm,
        witnessCalculator,
        zkey
    };
}
exports.fetchComponentsFromFilePaths = fetchComponentsFromFilePaths;
//# sourceMappingURL=utils.js.map