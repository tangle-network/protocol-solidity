import { BigNumberish, ethers } from 'ethers';
import { randomBN, poseidonHash, toBuffer } from './utils';
import { Keypair } from './keypair';
import { RootInfo } from '.';

const { BigNumber } = ethers



class Utxo {
  chainId: BigNumberish;
  amount: BigNumberish;
  blinding: BigNumberish;
  keypair: Keypair;
  index: number | null;
  _commitment: BigNumberish | null;
  _nullifier: BigNumberish | null;

  /** Initialize a new UTXO - unspent transaction output or input. Note, a full TX consists of 2/16 inputs and 2 outputs
   *
   * @param {BigNumber | BigInt | number | string} chainId The destination chain Id
   * @param {BigNumber | BigInt | number | string} amount UTXO amount
   * @param {BigNumber | BigInt | number | string} blinding Blinding factor
   * @param {Keypair} keypair
   * @param {number|null} index UTXO index in the merkle tree
   */
  constructor({ chainId = BigNumber.from(0), amount = BigNumber.from(0), keypair = new Keypair(), blinding = randomBN(), index = null } = {}) {
    this.chainId = BigNumber.from(chainId);
    this.amount = BigNumber.from(amount)
    this.blinding = BigNumber.from(blinding)
    this.keypair = keypair
    this.index = index
  }

  /**
   * Returns commitment for this UTXO
   *
   * @returns {BigNumber}
   */
  getCommitment() {
    if (!this._commitment) {
      this._commitment = poseidonHash([this.chainId, this.amount, this.blinding, this.keypair.pubkey])
    }
    return this._commitment
  }

  /**
   * Returns nullifier for this UTXO
   *
   * @returns {BigNumber}
   */
  getNullifier() {
    if (!this._nullifier) {
      if (
        this.amount > 0 &&
        (this.index === undefined ||
          this.index === null ||
          this.keypair.privkey === undefined ||
          this.keypair.privkey === null)
      ) {
        throw new Error('Can not compute nullifier without utxo index or private key')
      }
      this._nullifier = poseidonHash([this.getCommitment(), this.index || 0, this.keypair.privkey || 0])
    }
    return this._nullifier
  }

  getDiffs(roots: RootInfo[], chainId: BigNumberish): BigNumberish[] {
    if (this.chainId !== chainId) throw new Error('Chain Id mismatch');
    const diffs = []
    const targetRoot = roots.find(root => root.chainId === chainId);
    return roots.map(diff => {
      return BigNumber.from(diff.merkleRoot).sub(BigNumber.from(targetRoot.merkleRoot));
    });
  }

  /**
   * Encrypt UTXO data using the current keypair
   *
   * @returns {string} `0x`-prefixed hex string with data
   */
  encrypt() {
    const bytes = Buffer.concat([toBuffer(this.blinding, 31), toBuffer(this.amount, 31)])
    return this.keypair.encrypt(bytes)
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
    const buf = keypair.decrypt(data)
    return new Utxo({
      blinding: BigNumber.from('0x' + buf.slice(0, 31).toString('hex')),
      amount: BigNumber.from('0x' + buf.slice(31, 62).toString('hex')),
      keypair,
      index,
    })
  }
}

module.exports = Utxo