// Copyright 2022 Webb Technologies Inc.
// SPDX-License-Identifier: Apache-2.0
// This file has been modified by Webb Technologies Inc.

import { decrypt, encrypt, getEncryptionPublicKey } from '@metamask/eth-sig-util';
import { poseidon } from 'circomlibjs';
import { BigNumber, ethers } from 'ethers';

import { randomBN, toFixedHex } from '../utils';
import { FIELD_SIZE } from './';

export function packEncryptedMessage(encryptedMessage: any) {
  const nonceBuf = Buffer.from(encryptedMessage.nonce, 'base64');
  const ephemPublicKeyBuf = Buffer.from(encryptedMessage.ephemPublicKey, 'base64');
  const ciphertextBuf = Buffer.from(encryptedMessage.ciphertext, 'base64');
  const messageBuff = Buffer.concat([
    Buffer.alloc(24 - nonceBuf.length),
    nonceBuf,
    Buffer.alloc(32 - ephemPublicKeyBuf.length),
    ephemPublicKeyBuf,
    ciphertextBuf,
  ]);

  return '0x' + messageBuff.toString('hex');
}

export function unpackEncryptedMessage(encryptedMessage: any) {
  if (encryptedMessage.slice(0, 2) === '0x') {
    encryptedMessage = encryptedMessage.slice(2);
  }

  const messageBuff = Buffer.from(encryptedMessage, 'hex');
  const nonceBuf = messageBuff.subarray(0, 24);
  const ephemPublicKeyBuf = messageBuff.subarray(24, 56);
  const ciphertextBuf = messageBuff.subarray(56);

  return {
    ciphertext: ciphertextBuf.toString('base64'),
    ephemPublicKey: ephemPublicKeyBuf.toString('base64'),
    nonce: nonceBuf.toString('base64'),
    version: 'x25519-xsalsa20-poly1305',
  };
}

/**
 * A Keypair is an object that can group relevant keys for a user in the webb system.
 * The keys managed by a keypair are as follows:
 *    - pubkey: Required
 *      - used in commitments of circuits, to indicate ownership of a UTXO.
 *        The value can be derived from `pubkey = poseidon(privkey)`
 *    - encryptionKey: Optional
 *      - used to encrypting data for private communication. It is a pubkey of the privkey
 *        in a different cryptography scheme.
 *    - privkey: Optional
 *      - used for proving knowledge of a value and thus ability to spend UTXOs (creating nullifier).
 *      - used for decrypting data that has been encrypted with the encryptionKey.
 */
export class Keypair {
  // Stored as a hex-encoded 0x-prefixed 32 byte string
  privkey: string | undefined;
  private pubkey: ethers.BigNumber = BigNumber.from(0);
  // Stored as a base64 encryption key
  private encryptionKey: string | undefined;

  /**
   * Initialize a new keypair from a passed hex string. Generates a random private key if not defined.
   *
   * @param privkey - hex string of a field element for the
   * @returns - A 'Keypair' object with pubkey and encryptionKey values derived from the private key.
   */
  constructor(privkey = randomBN(32).toHexString()) {
    this.privkey = toFixedHex(BigNumber.from(privkey).mod(FIELD_SIZE));
    this.pubkey = BigNumber.from(poseidon([this.privkey]));
    this.encryptionKey = getEncryptionPublicKey(this.privkey.slice(2));
  }

  /**
   * @returns a string of public parts of this keypair object: pubkey and encryption key.
   */
  toString() {
    let retVal = toFixedHex(this.pubkey);

    if (this.encryptionKey) {
      retVal = retVal + Buffer.from(this.encryptionKey, 'base64').toString('hex');
    }

    return retVal;
  }

  /**
   * Initialize new keypair from string data.
   *
   * @param str - A string which contains public keydata.
   *   (0, 66), the slice for the pubKey value, 0x-prefixed, which is required.
   *   (66, 130), the slice for the encryptionKey value, which is optional to enable
   *              encrypt and decrypt functionality. It should be hex encoded.
   * @returns The keypair object configured with appropriate public values.
   * @throws If the string object is not 66 chars or 130 chars.
   */
  static fromString(str: string): Keypair {
    if (str.length === 66) {
      return Object.assign(new Keypair(), {
        encryptionKey: undefined,
        privkey: undefined,
        pubkey: BigNumber.from(str),
      });
    } else if (str.length === 130) {
      return Object.assign(new Keypair(), {
        encryptionKey: Buffer.from(str.slice(66, 130), 'hex').toString('base64'),
        privkey: undefined,
        pubkey: BigNumber.from(str.slice(0, 66)),
      });
    } else {
      throw new Error('Invalid string passed');
    }
  }

  // This static method supports encrypting a base64-encoded data,
  // with the provided hex-encoded encryption key
  static encryptWithKey(encryptionKey: string, data: string) {
    const base64Key = Buffer.from(encryptionKey.slice(2), 'hex').toString('base64');

    return packEncryptedMessage(
      encrypt({
        data,
        publicKey: base64Key,
        version: 'x25519-xsalsa20-poly1305',
      })
    );
  }

  /**
   * Encrypt data using keypair encryption key
   *
   * @param bytes - A buffer to encrypt
   * @returns a hex string encoding of encrypted data with this encryption key
   */
  encrypt(bytes: Buffer) {
    if (!this.encryptionKey) {
      throw new Error('Cannot encrypt without a configured encryption key');
    }

    return packEncryptedMessage(
      encrypt({
        data: bytes.toString('base64'),
        publicKey: this.encryptionKey,
        version: 'x25519-xsalsa20-poly1305',
      })
    );
  }

  /**
   * Decrypt data using keypair private key
   *
   * @param data - a hex string with data
   * @returns A Buffer of the decrypted data
   */
  decrypt(data: string) {
    if (!this.privkey) {
      throw new Error('Cannot decrypt without a configured private key');
    }

    return Buffer.from(
      decrypt({
        encryptedData: unpackEncryptedMessage(data),
        privateKey: this.privkey.slice(2),
      }),
      'base64'
    );
  }

  /**
   * @returns a 0x-prefixed, 32 fixed byte hex-string representation of the public key
   */
  getPubKey() {
    return toFixedHex(this.pubkey.toHexString());
  }

  /**
   * @returns a 0x-prefixed, 32 fixed byte hex-string representation of the encryption key
   */
  getEncryptionKey() {
    if (!this.encryptionKey) {
      return undefined;
    }

    return '0x' + Buffer.from(this.encryptionKey, 'base64').toString('hex');
  }
}
