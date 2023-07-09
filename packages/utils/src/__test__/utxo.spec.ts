import { expect } from 'chai';
import { Keypair } from '../protocol/keypair';
import { Utxo as CircomUtxo } from '../protocol/utxo';
import { Utxo } from '@webb-tools/sdk-core';
import { u8aToHex, hexToU8a } from '..';

describe('Utxo Class', () => {
  it('should construct with params', async function () {
    const utxo = await Utxo.generateUtxo({
      amount: '1',
      backend: 'Arkworks',
      chainId: '1',
      curve: 'Bn254',
      index: '0',
    });
    const nullifier = utxo.nullifier;
    const commitment = utxo.commitment;
    const blinding = utxo.blinding;
    const secretKey = utxo.secret_key;
    const amount = utxo.amount;
    const index = utxo.index;
    const serializedUtxo = utxo.serialize();
    const deserializedUtxo = await Utxo.deserialize(serializedUtxo);
    const nullifier2 = deserializedUtxo.nullifier;
    const commitment2 = deserializedUtxo.commitment;
    const blinding2 = deserializedUtxo.blinding;
    const secretKey2 = deserializedUtxo.secret_key;
    const amount2 = deserializedUtxo.amount;
    const index2 = deserializedUtxo.index;

    expect(nullifier2).to.deep.equal(nullifier);
    expect(secretKey2).to.deep.equal(secretKey);
    expect(blinding2).to.deep.equal(blinding);
    expect(amount2).to.deep.equal(amount);
    expect(index2).to.deep.equal(index);
    expect(u8aToHex(commitment2)).to.deep.equal(u8aToHex(commitment));
  });

  it('should deserialize and serialize to the same value when all secrets passed', async function () {
    const serializedInput = [
      'Bn254',
      'Arkworks',
      '1000',
      '20000000438',
      '17415b69c56a3c3897dcb339ce266a0f2a70c9372a6fec1676f81ddaf68e9926',
      '2b1297db7d088c2e3fdfa7e626518c5ea6039917e8a75119bc0bb162b30f7a1c',
      '258f154ce1eee4af55674c5b7c8b6976864f3f3c5af474c105dad8a372db9850',
      '25e8b77121b8fcbf2332970720cd5b51d20a0548ca142eb8ae7814a53225d82c',
      '1',
    ].join('&');
    const deserialized = await Utxo.deserialize(serializedInput);

    const serializedOutput = deserialized.serialize();

    expect(serializedOutput).to.deep.equal(serializedInput);
  });

  it('should deserialize and serialize a utxo which does not have an index', async function () {
    const serializedInput = [
      'Bn254',
      'Arkworks',
      '10000000000000',
      '2199023256632',
      '17415b69c56a3c3897dcb339ce266a0f2a70c9372a6fec1676f81ddaf68e9926',
      '2b1297db7d088c2e3fdfa7e626518c5ea6039917e8a75119bc0bb162b30f7a1c',
      '258f154ce1eee4af55674c5b7c8b6976864f3f3c5af474c105dad8a372db9850',
      '25e8b77121b8fcbf2332970720cd5b51d20a0548ca142eb8ae7814a53225d82c',
      '',
    ].join('&');

    const deserialized = await Utxo.deserialize(serializedInput);
    const serializedOutput = deserialized.serialize();

    expect(serializedOutput).to.deep.equal(serializedInput);
  });

  it('should deserialize and serialize a "public utxo"', async function () {
    const keypair = Keypair.fromString(
      '0x1111111111111111111111111111111111111111111111111111111111111111'
    );

    const utxo = await CircomUtxo.generateUtxo({
      amount: '10',
      backend: 'Arkworks',
      chainId: '1',
      curve: 'Bn254',
      keypair,
    });

    const serializedUtxo = utxo.serialize();

    const deserializedUtxo = await Utxo.deserialize(serializedUtxo);
    const utxoString = deserializedUtxo.serialize();

    expect(utxoString).to.deep.equal(serializedUtxo);
  });

  it('CircomUtxo and Utxo should generate compatible outputs public utxo', async function () {
    const keypair = Keypair.fromString(
      '0x1111111111111111111111111111111111111111111111111111111111111111'
    );
    const blinding = hexToU8a(
      '0x17415b69c56a3c3897dcb339ce266a0f2a70c9372a6fec1676f81ddaf68e9926',
      256
    );

    const utxo = await Utxo.generateUtxo({
      amount: '1000000000',
      backend: 'Arkworks',
      blinding,
      chainId: '2199023256632',
      curve: 'Bn254',
      index: '0',
      keypair: keypair as unknown as any,
    });
    const circomUtxo = await CircomUtxo.generateUtxo({
      amount: '1000000000',
      backend: 'Circom',
      blinding,
      chainId: '2199023256632',
      curve: 'Bn254',
      index: '0',
      keypair,
    });

    expect(utxo.amount).to.deep.equal(circomUtxo.amount);
    expect(utxo.chainId).to.deep.equal(circomUtxo.chainId);
    expect(utxo.public_key).to.deep.equal(circomUtxo.public_key);
    expect(utxo.blinding).to.deep.equal(circomUtxo.blinding);
    expect(utxo.commitment).to.deep.equal(circomUtxo.commitment);
  });

  it('CircomUtxo and Utxo should generate compatible outputs private utxo', async function () {
    const keypair = new Keypair();
    const blinding = hexToU8a(
      '0x17415b69c56a3c3897dcb339ce266a0f2a70c9372a6fec1676f81ddaf68e9926',
      256
    );

    const utxo = await Utxo.generateUtxo({
      amount: '1000000000',
      backend: 'Arkworks',
      blinding,
      chainId: '2199023256632',
      curve: 'Bn254',
      index: '0',
      keypair: keypair as unknown as any,
    });
    const circomUtxo = await CircomUtxo.generateUtxo({
      amount: '1000000000',
      backend: 'Circom',
      blinding,
      chainId: '2199023256632',
      curve: 'Bn254',
      index: '0',
      keypair,
    });

    expect(utxo.amount).to.deep.equal(circomUtxo.amount);
    expect(utxo.chainId).to.deep.equal(circomUtxo.chainId);
    expect(utxo.keypair.toString()).to.deep.equal(circomUtxo._keypair.toString());
    expect(utxo.public_key).to.deep.equal(circomUtxo.public_key);
    expect(utxo.secret_key).to.deep.equal(circomUtxo.secret_key);
    expect(utxo.blinding).to.deep.equal(circomUtxo.blinding);
    expect(utxo.commitment).to.deep.equal(circomUtxo.commitment);
    expect(utxo.nullifier).to.deep.equal(circomUtxo.nullifier);
  });

  it('Check valid encryption length', async function () {
    const kp = new Keypair();

    const enc = Keypair.encryptWithKey(kp.getEncryptionKey()!, 'jumbo');

    try {
      await CircomUtxo.decrypt(kp, enc);
    } catch (ex: any) {
      expect(ex.message).to.contain('malformed utxo encryption');
    }
  });

  it('Should set the index of an CircomUtxo', async function () {
    const keypair = new Keypair();

    const utxo = await CircomUtxo.generateUtxo({
      amount: '0',
      backend: 'Arkworks',
      chainId: '1',
      curve: 'Bn254',
      index: '0',
      keypair,
    });

    utxo.setIndex(2);

    expect(utxo.index).to.eq(2);
  });
});
