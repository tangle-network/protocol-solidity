require('dotenv').config();
const path = require('path');
import { ethers } from 'ethers';
import { fetchComponentsFromFilePaths } from '../../packages/utils';

const providerGanache = new ethers.providers.JsonRpcProvider(`http://localhost:8545`);
const walletGanache = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGanache);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log('keccak hash: ', ethers.utils.keccak256("tornado"));
}

run();

