require('dotenv').config();
import { ethers } from 'ethers';
import { VAnchor } from '@webb-tools/anchors';
import path from 'path';
import { fetchComponentsFromFilePaths, getChainIdType } from '@webb-tools/utils';
import { CircomUtxo, Keypair, randomBN, Utxo } from '@webb-tools/sdk-core';
import { hexToU8a } from '@polkadot/util';

export async function transactWrapNative(anchorAddress: string, sender: ethers.Signer) {
  const zkComponentsSmall = await fetchComponentsFromFilePaths(
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_2/8/poseidon_vanchor_2_8.wasm`
    ),
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_2/8/witness_calculator.cjs`
    ),
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_2/8/circuit_final.zkey`
    )
  );
  const zkComponentsLarge = await fetchComponentsFromFilePaths(
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_16/8/poseidon_vanchor_16_8.wasm`
    ),
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_16/8/witness_calculator.cjs`
    ),
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_16/8/circuit_final.zkey`
    )
  );
  const anchor = await VAnchor.connect(anchorAddress, zkComponentsSmall, zkComponentsLarge, sender);
  const sourceChainId = getChainIdType(5001);
  const randomKeypair = new Keypair();

  const utxo = await CircomUtxo.generateUtxo({
    curve: 'Bn254',
    backend: 'Circom',
    chainId: sourceChainId.toString(),
    originChainId: sourceChainId.toString(),
    amount: '1000000000000000',
    keypair: randomKeypair,
  })

  // Build up the inputs for proving manager
  const dummyOutputUtxo = await CircomUtxo.generateUtxo({
    curve: 'Bn254',
    backend: 'Circom',
    chainId: sourceChainId.toString(),
    originChainId: sourceChainId.toString(),
    amount: '0',
    keypair: randomKeypair,
  });
  const inputs: Utxo[] = [];
  const outputs: [Utxo, Utxo] = [utxo, dummyOutputUtxo];

  while (inputs.length !== 2 && inputs.length < 16) {
    inputs.push(
      await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: sourceChainId.toString(),
        originChainId: sourceChainId.toString(),
        amount: '0',
        blinding: hexToU8a(randomBN(31).toHexString()),
        keypair: randomKeypair,
      })
    );
  }

  const tx = await anchor.transactWrap(
    '0x0000000000000000000000000000000000000000',
    inputs,
    outputs,
    '0',
    '0x0000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000000',
    {}
  );
}
