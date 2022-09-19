require('dotenv').config();
const path = require('path');
import { BigNumber, ethers } from 'ethers';
import { toFixedHex, Note, Keypair, CircomUtxo, Utxo } from '@webb-tools/sdk-core';
import type { JsNote } from '@webb-tools/wasm-utils';
import { VAnchor, VAnchor__factory } from '@webb-tools/contracts';
import { hexToU8a, u8aToHex } from '@webb-tools/utils';

const providerGanache = new ethers.providers.JsonRpcProvider(`http://localhost:5001`);
const walletGanache = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGanache);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function utxoFromVAnchorNote(note: JsNote, leafIndex: number): Promise<Utxo> {
  const noteSecretParts = note.secrets.split(':');
  const chainId = note.targetChainId;
  const amount = BigNumber.from('0x' + noteSecretParts[1]).toString();
  const secretKey = '0x' + noteSecretParts[2];
  const blinding = '0x' + noteSecretParts[3];
  const originChainId = note.sourceChainId;

  const keypair = new Keypair(secretKey);

  return CircomUtxo.generateUtxo({
    curve: note.curve,
    backend: note.backend,
    amount,
    blinding: hexToU8a(blinding),
    originChainId,
    chainId,
    index: leafIndex.toString(),
    keypair,
  });
}

async function run() {
  const vanchor = VAnchor__factory.connect('0xbfce6B877Ebff977bB6e80B24FbBb7bC4eBcA4df', walletGanache);

  // View the 'new nullifier' event emissions.
  const filter = vanchor.filters.NewNullifier(null);

  const results = await vanchor.queryFilter(filter, 3800);
  results.map((event) => {
    console.log('event: ', event);
  })

  const note = await Note.deserialize('webb://v1:vanchor/1099511632777:1099511632777/0xbfce6B877Ebff977bB6e80B24FbBb7bC4eBcA4df:0xbfce6B877Ebff977bB6e80B24FbBb7bC4eBcA4df/0000010000001389:0000000000000000000000000000000000000000000000022b1c8c1227a00000:eef64392ec07050999cf156ddc8a0c56861638708512ba3a0995180ba32e0020:007610615ad81b764a180af265fba71acd158f9bcf7f47f7a53e855239fdb09e/?curve=Bn254&width=4&exp=5&hf=Poseidon&backend=Circom&token=webbDEV&denom=18&amount=40000000000000000000')

  const utxo = await utxoFromVAnchorNote(note.note, 4);
  console.log('utxo nullifier: ', toFixedHex(utxo.nullifier));
}

run();

