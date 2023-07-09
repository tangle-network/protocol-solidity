import { getEncryptionPublicKey } from '@metamask/eth-sig-util';
import assert from 'assert';
import { poseidon } from 'circomlibjs';
import { Keypair } from '../protocol/keypair';
import { toFixedHex } from '../utils';

describe('Keypair constructor tests', () => {
  it('Should create a Keypair when using the constructor with a private key', async function () {
    const testPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const keypair = new Keypair(testPrivateKey);

    const expectedPubkey = poseidon([testPrivateKey]);
    const expectedEncryptionKey =
      '0x' + Buffer.from(getEncryptionPublicKey(testPrivateKey.slice(2)), 'base64').toString('hex');

    assert(keypair.getPubKey() === toFixedHex(expectedPubkey));
    assert(keypair.getEncryptionKey() === expectedEncryptionKey);

    const encryptedValue = keypair.encrypt(Buffer.from('hello'));
    const decryptedValue = keypair.decrypt(encryptedValue);

    assert(Buffer.from('hello').toString() === decryptedValue.toString());
  });

  it('Should create a Keypair consisting of just the public key', async function () {
    const testPublicKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const keypair = Keypair.fromString(testPublicKey);

    assert(keypair.getPubKey() === toFixedHex(testPublicKey));
    assert(keypair.privkey === undefined);
    assert(keypair.getEncryptionKey() === undefined);
    assert.throws(() => keypair.encrypt(Buffer.from('hi')));
  });

  it('Should create a Keypair consisting of public key and encryption key', async function () {
    const testPublicKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const testEncryptionKey = '0x0000000000000000000000000000000000000000000000000000000000000002';
    const testPublicData = testPublicKey + testEncryptionKey.slice(2);
    const keypair = Keypair.fromString(testPublicData);

    assert(keypair.getPubKey() === toFixedHex(testPublicKey), 'public keys not equal');
    assert(keypair.toString() === testPublicData, 'serialize and deserialize the same values');
    assert(keypair.getEncryptionKey() === testEncryptionKey, 'encryption keys not equal');
    // make a call to encrypt and ensure the function does not throw.
    const encryptedValue = keypair.encrypt(Buffer.from('hello'));

    // make a call to decrypt and ensure the function throws
    assert.throws(() => keypair.decrypt(encryptedValue));
  });
});
