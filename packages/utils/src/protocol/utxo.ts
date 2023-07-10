import { poseidon } from 'circomlibjs';
import { BigNumber } from 'ethers';
import { randomBN, toBuffer, toFixedHex } from '../utils';
import { Keypair } from './keypair';
import { Curve, Backend } from './note';
import { hexToU8a, u8aToHex } from '../bytes';

export type UtxoGenInput = {
  curve: Curve;
  backend: Backend;
  amount: string;
  chainId: string;
  blinding?: Uint8Array;
  index?: string;
  keypair?: Keypair;
  originChainId?: string;
};

export class Utxo {
  _keypair: Keypair = new Keypair();
  _curve: Curve = 'Bn254';
  _backend: Backend = 'Circom';
  _amount = '';
  _chainId = '';
  _index?: number;
  _pubkey = '';
  _secret_key = '';
  _blinding = '';
  _originChainId?: string;

  serialize(): string {
    return [
      this._curve,
      this._backend,
      this.amount,
      this.chainId,
      this.blinding,
      this.getKeypair().getPubKey().slice(2),
      this.getKeypair().getEncryptionKey()?.slice(2),
      this.getKeypair().privkey?.slice(2),
      this.index.toString(),
    ].join('&');
  }

  /**
   * @param utxoString - A string representation of the parts that make up a utxo.
   *   - All values are represented as BigEndian, hex-encoded strings unless indicated otherwise.
   *   - Optional values are represented as the empty string if not present,
   *     meaning the split call will always be an array of length "parts".
   *
   *   parts[0] - Curve value, e.g. Bn254, Bls381, Ed25519, etc. value represented as string.
   *   parts[1] - Backend value, e.g. arkworks or circom. value represented as string.
   *   parts[2] - Amount of atomic units, e.g. ETH in wei amounts or DOT in 10^12 decimals. value represented as uint.
   *   parts[3] - TypedChainId, the hex value of the calculated typed chain id
   *   parts[4] - Blinding, secret random value
   *   parts[5] - PublicKey, the "publicKey = hash(privateKey)" value which indicates ownership for a utxo.
   *   parts[6] Optional - EncryptionKey, the public key of "publicKey = encryptionScheme(privateKey)" value used for messaging.
   *   parts[7] Optional - PrivateKey, the secret key component correlated to the above values.
   *   parts[8] Optional - Index, the leaf index if the utxo has been inserted in a merkle tree
   * @returns The Utxo object implementation of a Utxo.
   */
  static deserialize(utxoString: string): Utxo {
    const utxo = new Utxo();
    const parts = utxoString.split('&');

    utxo._curve = 'Bn254';
    utxo._backend = 'Circom';
    utxo._amount = parts[2];
    utxo._chainId = parts[3];
    utxo._blinding = parts[4];
    utxo._pubkey = parts[5];
    const maybeEncryptionKey = parts[6];
    const maybeSecretKey = parts[7];
    const maybeIndex = parts[8];

    if (maybeSecretKey.length === 64) {
      utxo.setKeypair(new Keypair('0x' + maybeSecretKey));
    } else {
      if (maybeEncryptionKey.length === 64) {
        utxo.setKeypair(Keypair.fromString('0x' + utxo._pubkey + maybeEncryptionKey));
      } else {
        utxo.setKeypair(Keypair.fromString('0x' + utxo._pubkey));
      }
    }

    if (maybeIndex.length > 0) {
      utxo._index = Number(maybeIndex);
    }

    return utxo;
  }

  static generateUtxo(input: UtxoGenInput): Utxo {
    const utxo = new Utxo();

    // Required parameters
    utxo._amount = input.amount;
    utxo._chainId = input.chainId;
    utxo._curve = input.curve;
    utxo._backend = input.backend;

    // Optional parameters
    utxo._index = input.index ? Number(input.index) : 0;

    if (input.keypair) {
      utxo.setKeypair(input.keypair);
    } else {
      // Populate the _pubkey and _secret_key values with
      // the random default keypair
      utxo.setKeypair(utxo.getKeypair());
    }

    utxo._blinding = input.blinding
      ? u8aToHex(input.blinding).slice(2)
      : toFixedHex(randomBN(31)).slice(2);
    utxo.setOriginChainId(input.originChainId);

    return utxo;
  }

  /**
   * Encrypt UTXO data using the current keypair.
   * This is used in the externalDataHash calculations so the funds for this deposit
   * can only be spent by the owner of `this.keypair`.
   *
   * @returns `0x`-prefixed hex string with data
   */
  encrypt() {
    if (!this.getKeypair().getEncryptionKey()) {
      throw new Error('Must have a configured encryption key on the keypair to encrypt the utxo');
    }

    const bytes = Buffer.concat([
      toBuffer(BigNumber.from(this._chainId), 8),
      toBuffer(BigNumber.from(this._amount), 32),
      toBuffer(BigNumber.from('0x' + this._blinding), 32),
    ]);

    return this.getKeypair().encrypt(bytes);
  }

  /**
   * Decrypt a UTXO
   *
   * @param keypair - keypair used to decrypt
   * @param data - hex string with data
   * @returns a UTXO object
   */
  static decrypt(keypair: Keypair, data: string) {
    const buf = keypair.decrypt(data);

    if (buf.length !== 72) {
      throw new Error('malformed utxo encryption');
    }

    const utxo = Utxo.generateUtxo({
      amount: BigNumber.from('0x' + buf.subarray(8, 8 + 32).toString('hex')).toString(),
      backend: 'Circom',
      blinding: hexToU8a(toFixedHex('0x' + buf.subarray(8 + 32, 8 + 64).toString('hex'))),
      chainId: BigNumber.from('0x' + buf.subarray(0, 8).toString('hex')).toString(),
      curve: 'Bn254',
      keypair,
    });

    return utxo;
  }

  get keypair(): Keypair {
    return this._keypair;
  }

  set keypair(keypair: Keypair) {
    this._keypair = keypair;
  }

  get amount(): string {
    return this._amount;
  }

  set amount(amount: string) {
    this._amount = amount;
  }

  get blinding(): string {
    return this._blinding;
  }

  set blinding(blinding: string) {
    this._blinding = blinding;
  }

  get chainId(): string {
    return this._chainId;
  }

  set chainId(chainId: string) {
    this._chainId = chainId;
  }

  get originChainId(): string | undefined {
    return this._originChainId;
  }

  set originChainId(originChainId: string | undefined) {
    this._originChainId = originChainId;
  }

  /**
   * Returns commitment for this UTXO
   *
   * @returns the poseidon hash of [chainId, amount, pubKey, blinding]
   */
  get commitment(): Uint8Array {
    const hash = poseidon([
      this._chainId,
      this._amount,
      '0x' + this._pubkey,
      '0x' + this._blinding,
    ]);

    return hexToU8a(BigNumber.from(hash).toHexString());
  }

  /**
   * @returns the index configured on this UTXO. Output UTXOs generated
   * before they have been inserted in a tree.
   *
   */
  get index(): number {
    return this._index ?? 0;
  }

  set index(index: number) {
    this._index = index;
  }

  /**
   * @returns the nullifier: hash of [commitment, index, signature] as decimal string
   * where signature = hash([secret key, commitment, index])
   */
  get nullifier(): string {
    // If the amount of the UTXO is zero, then the nullifier is not important.
    // Return a 'dummy' value that will satisfy the circuit
    // Enforce index on the UTXO if there is an amount greater than zero
    if (!this.getKeypair() || !this.getKeypair().privkey) {
      throw new Error('Cannot create nullifier, keypair with private key not configured');
    }

    const x = poseidon([
      u8aToHex(this.commitment),
      this.index > 0 ? this.index : 0,
      // The following parameter is the 'ownership hash', a portion of the nullifier that enables
      // compliance, and ties a utxo to a particular keypair.
      poseidon([this.getKeypair().privkey, u8aToHex(this.commitment), this.index]),
    ]);

    return toFixedHex(x).slice(2);
  }

  get public_key(): string {
    return this._pubkey;
  }

  /**
   * @returns the secret_key AKA private_key used in the nullifier.
   * this value is used to derive the public_key for the commitment.
   */
  get secret_key(): string {
    return this._secret_key;
  }

  set secret_key(secret: string) {
    this._secret_key = secret;
  }

  getKeypair(): Keypair {
    return this._keypair;
  }

  setKeypair(keypair: Keypair): void {
    this._pubkey = keypair.getPubKey().slice(2);

    if (keypair.privkey) {
      this._secret_key = keypair.privkey.slice(2);
    }

    this._keypair = keypair;
  }

  setOriginChainId(originChainId: string | undefined) {
    this._originChainId = originChainId;
  }

  setIndex(val: number): void {
    this.index = val;
  }
}
