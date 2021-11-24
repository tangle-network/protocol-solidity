require('dotenv').config();
const path = require('path');
import { ethers } from 'ethers';
import { Anchor } from '../../packages/fixed-bridge';
import { bridgedWithdrawErc20Token } from './withdrawals/bridgedWithdrawErc20Token';
import { depositAndBridgedWithdraw } from './bridgeActions/depositAndBridgedWithdraw';
import { fetchComponentsFromFilePaths } from '../../packages/utils';

const providerGanache = new ethers.providers.JsonRpcProvider(`http://localhost:8545`);
const walletGanache = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGanache);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey')
  );

  
}

run();

