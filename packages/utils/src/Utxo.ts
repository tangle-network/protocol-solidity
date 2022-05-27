import { BigNumber, BigNumberish } from 'ethers';
import { randomBN, poseidonHash, toBuffer } from './utils';
import { Keypair } from './Keypair';
import { RootInfo } from './types';

const F = require('circomlibjs').babyjub.F;
const Scalar = require('ffjavascript').Scalar;

export class Utxo {
  chainId: BigNumber;
  amount: BigNumber;
  blinding: BigNumber;
  keypair: Keypair;
  originChainId: BigNumber;
  index: number | null;
  _commitment?: BigNumber;
  _nullifier?: BigNumber;

  /** Initialize a new UTXO - unspent transaction output or input. Note, a full TX consists of 2/16 inputs and 2 outputs
   *
   * @param {BigNumber | BigInt | number | string} chainId The destination chain Id
   * @param {BigNumber | BigInt | number | string} amount UTXO amount
   * @param {BigNumber | BigInt | number | string} blinding Blinding factor
   * @param {Keypair} keypair
   * @param {number|null} index UTXO index in the merkle tree
   */
  constructor({
    chainId,
    amount,
    keypair,
    blinding,
    originChainId,
    index
  }: {chainId: BigNumberish, amount?: BigNumberish, keypair?: Keypair, blinding?: BigNumberish, originChainId?: BigNumberish, index?: number}) {
    this.chainId = BigNumber.from(chainId);
    this.amount = amount ? BigNumber.from(amount) : BigNumber.from(0);
    this.blinding = blinding ? BigNumber.from(blinding) : randomBN();
    this.keypair = keypair || new Keypair();
    this.originChainId = originChainId ? BigNumber.from(originChainId) : BigNumber.from(0);
    this.index = index;
  }

  /**
   * Returns commitment for this UTXO
   *
   * @returns {BigNumber}
   */
  getCommitment() {
    if (!this._commitment) {
      this._commitment = poseidonHash([this.chainId, this.amount, this.keypair.pubkey, this.blinding])
    }

    return this._commitment;
  }

  /**
   * Returns nullifier for this UTXO
   *
   * @returns {BigNumber}
   */
  getNullifier() {
    if (!this._nullifier) {
      if (
        this.amount.lt(0) &&
        (this.index === undefined ||
          this.index === null ||
          this.keypair.privkey === undefined ||
          this.keypair.privkey === null)
      ) {
        throw new Error('Can not compute nullifier without utxo index or private key')
      }
      const signature = this.keypair.privkey ? this.keypair.sign(BigNumber.from(this.getCommitment()), this.index || 0) : 0
      this._nullifier = poseidonHash([this.getCommitment(), this.index || 0, signature])
    }
    return this._nullifier
  }

  getDiffs(roots: RootInfo[]): BigNumberish[] {
    const targetRoot = roots.find(root => root.chainId.toString() === this.originChainId.toString());
    return roots.map(diff => {
      return BigNumber.from(F.sub(Scalar.fromString(diff.merkleRoot.toString()), Scalar.fromString(targetRoot?.merkleRoot.toString())).toString())
    });
   
  }

  /**
   * Encrypt UTXO data using the current keypair
   *
   * @returns {string} `0x`-prefixed hex string with data
   */
  encrypt() {
    const bytes = Buffer.concat([toBuffer(this.chainId, 16), toBuffer(this.amount, 31), toBuffer(this.blinding, 31)])
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
  static decrypt(keypair: Keypair, data: string, index: number) {
    const buf = keypair.decrypt(data)
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
