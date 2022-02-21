import { SignatureBridgeSide } from "@webb-tools/bridges";
import { fetchComponentsFromFilePaths } from "@webb-tools/utils";
import { ethers } from "ethers";

require('dotenv').config();
const path = require('path');

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);

const providerGanache = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:5002`);
const walletGanache = new ethers.Wallet("0x0000000000000000000000000000000000000001", providerGanache);

async function run() {

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/poseidon_bridge_6.wasm'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/witness_calculator.js'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/circuit_final.zkey')
  );

  const bridgeSide = await SignatureBridgeSide.connect('0x2946259E0334f33A064106302415aD3391BeD384', walletGanache, walletGanache);

  const governor = await bridgeSide.contract.governor();
  console.log('governor is: ', governor);
  const walletAddress = await walletGanache.getAddress();
  console.log('wallet is: ', walletAddress);
}

run();

