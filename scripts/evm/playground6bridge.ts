require('dotenv').config();
const path = require('path');
import { ethers } from 'ethers';
import { Anchor } from '@webb-tools/fixed-bridge';
import { depositNativeAndBridgedWithdraw } from './bridgeActions/depositNativeAndBridgedWithdraw';
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';

const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
const providerRopsten = new ethers.providers.JsonRpcProvider(`https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletRopsten = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRopsten);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/poseidon_bridge_6.wasm'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/witness_calculator.js'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/circuit_final.zkey')
  );

  const rinkebyAnchor = await Anchor.connect('0x99285189A0DA76dce5D3Da6Cf71aD3f2b498DC88', zkComponents, walletRinkeby);
  await rinkebyAnchor.checkKnownRoot();
  const ropstenAnchor = await Anchor.connect('0x8DB24d0Df8cc4CEbF275528f7725E560F50329bf', zkComponents, walletRopsten);
  await ropstenAnchor.checkKnownRoot();

  await depositNativeAndBridgedWithdraw(rinkebyAnchor, ropstenAnchor, walletRinkeby, walletRopsten, '0x7Bb1Af8D06495E85DDC1e0c49111C9E0Ab50266E');
}

run();

