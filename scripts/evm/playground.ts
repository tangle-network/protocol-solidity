require('dotenv').config();
const path = require('path');
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';
import { ethers } from 'ethers';
import { Anchor } from '@webb-tools/fixed-bridge';
import { viewEdgeList } from './viewActions/viewEdgeList';

const providerRopsten = new ethers.providers.JsonRpcProvider(`https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletRopsten = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRopsten);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/poseidon_bridge_6.wasm'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/witness_calculator.js'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/circuit_final.zkey')
  );
  const anchorRopsten = await Anchor.connect('0x8DB24d0Df8cc4CEbF275528f7725E560F50329bf', zkComponents, walletRopsten);

  await viewEdgeList(anchorRopsten, 4);
}

run();

