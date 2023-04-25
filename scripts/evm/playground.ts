require('dotenv').config();
const path = require('path');
import { ethers, JsonRpcProvider } from 'ethers';
import { VAnchor__factory } from '@webb-tools/contracts';
import { CircomUtxo } from '@webb-tools/sdk-core/solidity-utils';
import { calculateTypedChainId, ChainType } from '@webb-tools/sdk-core/typed-chain-id';

const providerGanache = new JsonRpcProvider(`http://localhost:5001`);
const walletGanache = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGanache);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const vanchor = VAnchor__factory.connect(
    '0x4e3df2073bf4b43b9944b8e5a463b1e185d6448c',
    walletGanache
  );

  const utxo = await CircomUtxo.generateUtxo({
    amount: '1000000',
    backend: 'Circom',
    curve: 'Bn254',
    chainId: calculateTypedChainId(ChainType.EVM, 5002).toString(),
    originChainId: calculateTypedChainId(ChainType.EVM, 5001).toString(),
  });
}

run();
