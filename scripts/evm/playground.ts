import { SignatureBridgeSide } from "@webb-tools/bridges";
import { Anchor } from "@webb-tools/anchors";
import { ethers } from "ethers";
import { fetchComponentsFromFilePaths } from "../../packages/utils";

require('dotenv').config();
const path = require('path');

// export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);

// const providerGanache = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:5002`);
// const walletGanache = new ethers.Wallet("0x0000000000000000000000000000000000000001", providerGanache);

async function run() {


  // const zkComponents = await fetchComponentsFromFilePaths(
  //   path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/6/poseidon_anchor_6.wasm'),
  //   path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/6/witness_calculator.js'),
  //   path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/6/circuit_final.zkey')
  // );
  
  // const hasher = new PoseidonHasher();
  // const commitment = hasher.hash3(['0000020000000438', '0xe015a65c31d6a3cc42db76434caef90c65005857d5d5539a4ee950a250a3fe05', '0x13cdc3699e18591bc139d8f73e156baaeaea8156d6ea9e5eb69223ee0560e017']);
  // const nullifierHash = hasher.hash(null, '0xe015a65c31d6a3cc42db76434caef90c65005857d5d5539a4ee950a250a3fe05', '0xe015a65c31d6a3cc42db76434caef90c65005857d5d5539a4ee950a250a3fe05')

  // const anchor = await Anchor.connect('0x40f587e4782f4457541c2971d700ebb888262ac7', zkComponents, walletGoerli);

  // console.log('denomination in anchor wrapper: ', anchor.denomination);

  // const contractDenom = await anchor.contract.denomination();

  // console.log('denomination in contract: ', contractDenom);
}

run();

