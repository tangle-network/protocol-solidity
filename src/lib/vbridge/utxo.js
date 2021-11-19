"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Utxo = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("./utils");
const keypair_1 = require("./keypair");
const { BigNumber } = ethers_1.ethers;
const F = require('circomlibjs').babyjub.F;
const Scalar = require('ffjavascript').Scalar;
class Utxo {
    /** Initialize a new UTXO - unspent transaction output or input. Note, a full TX consists of 2/16 inputs and 2 outputs
     *
     * @param {BigNumber | BigInt | number | string} chainId The destination chain Id
     * @param {BigNumber | BigInt | number | string} amount UTXO amount
     * @param {BigNumber | BigInt | number | string} blinding Blinding factor
     * @param {Keypair} keypair
     * @param {number|null} index UTXO index in the merkle tree
     */
    constructor({ chainId = BigNumber.from(0), amount = BigNumber.from(0), keypair = new keypair_1.Keypair(), blinding = (0, utils_1.randomBN)(), originChainId = BigNumber.from(31337), index = null } = {}) {
        this.chainId = BigNumber.from(chainId);
        this.amount = BigNumber.from(amount);
        this.blinding = BigNumber.from(blinding);
        this.keypair = keypair;
        this.originChainId = originChainId;
        this.index = index;
    }
    /**
     * Returns commitment for this UTXO
     *
     * @returns {BigNumber}
     */
    getCommitment() {
        if (!this._commitment) {
            this._commitment = (0, utils_1.poseidonHash)([this.chainId, this.amount, this.keypair.pubkey, this.blinding]);
        }
        // console.log("chainId")
        // console.log(this.chainId);
        // console.log("amount");
        // console.log(this.amount);
        // console.log("pubkey");
        // console.log(this.keypair.pubkey);
        // console.log("blinding");
        // console.log(this.blinding);
        // console.log("commitment");
        // console.log(this._commitment);
        return this._commitment;
    }
    /**
     * Returns nullifier for this UTXO
     *
     * @returns {BigNumber}
     */
    getNullifier() {
        if (!this._nullifier) {
            if (this.amount > 0 &&
                (this.index === undefined ||
                    this.index === null ||
                    this.keypair.privkey === undefined ||
                    this.keypair.privkey === null)) {
                throw new Error('Can not compute nullifier without utxo index or private key');
            }
            this._nullifier = (0, utils_1.poseidonHash)([this.getCommitment(), this.index || 0, this.keypair.privkey || 0]);
        }
        return this._nullifier;
    }
    getDiffs(roots) {
        // console.log("roots is:");
        // console.log(roots);
        const targetRoot = roots.find(root => root.chainId.toString() === this.originChainId.toString());
        // console.log("target root is:");
        // console.log(targetRoot);
        // console.log("diffs is");
        // console.log(roots.map(diff => {
        //   return BigNumber.from(diff.merkleRoot).sub(BigNumber.from(targetRoot?.merkleRoot));
        // }));
        return roots.map(diff => {
            return BigNumber.from(F.sub(Scalar.fromString(diff.merkleRoot.toString()), Scalar.fromString(targetRoot === null || targetRoot === void 0 ? void 0 : targetRoot.merkleRoot.toString())).toString());
        });
    }
    /**
     * Encrypt UTXO data using the current keypair
     *
     * @returns {string} `0x`-prefixed hex string with data
     */
    encrypt() {
        const bytes = Buffer.concat([(0, utils_1.toBuffer)(this.chainId, 16), (0, utils_1.toBuffer)(this.amount, 31), (0, utils_1.toBuffer)(this.blinding, 31)]);
        return this.keypair.encrypt(bytes);
    }
    /**
     * Decrypt a UTXO
     *
     * @param {Keypair} keypair keypair used to decrypt
     * @param {string} data hex string with data
     * @param {number} index UTXO index in merkle tree
     * @returns {Utxo}
     */
    static decrypt(keypair, data, index) {
        const buf = keypair.decrypt(data);
        const utxo = new Utxo({
            chainId: BigNumber.from('0x' + buf.slice(0, 16).toString('hex')),
            amount: BigNumber.from('0x' + buf.slice(16, 16 + 31).toString('hex')),
            blinding: BigNumber.from('0x' + buf.slice(16 + 31, 16 + 62).toString('hex')),
            keypair,
        });
        utxo.index = index;
        return utxo;
    }
}
exports.Utxo = Utxo;
//# sourceMappingURL=utxo.js.map