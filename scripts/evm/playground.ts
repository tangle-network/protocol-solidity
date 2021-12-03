require('dotenv').config();
const path = require('path');
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';
import { ethers } from 'ethers';
import { Anchor } from '@webb-tools/fixed-bridge';
import { viewEdgeList } from './viewActions/viewEdgeList';

const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
const providerKovan = new ethers.providers.JsonRpcProvider(`https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletKovan = new ethers.Wallet(process.env.PRIVATE_KEY!, providerKovan);
const providerRopsten = new ethers.providers.JsonRpcProvider(`https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletRopsten = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRopsten);
const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);
const providerOptimism = new ethers.providers.JsonRpcProvider('https://kovan.optimism.io');
const walletOptimism = new ethers.Wallet(process.env.PRIVATE_KEY!, providerOptimism);
const providerArbitrum = new ethers.providers.JsonRpcProvider('https://rinkeby.arbitrum.io/rpc');
const walletArbitrum = new ethers.Wallet(process.env.PRIVATE_KEY!, providerArbitrum);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/poseidon_bridge_6.wasm'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/witness_calculator.js'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/circuit_final.zkey')
  );
  const anchorRopsten = await Anchor.connect('0x8DB24d0Df8cc4CEbF275528f7725E560F50329bf', zkComponents, walletRopsten);

  // const edgeListEntry = await anchorRopsten.contract.edgeList(3);
  // console.log(edgeListEntry);
  const neighborRoots = await anchorRopsten.contract.getLatestNeighborRoots();
  console.log(neighborRoots);
  // await viewEdgeList(anchorRopsten, 62);
}

run();

