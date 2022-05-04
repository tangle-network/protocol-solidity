import { SignatureBridgeSide } from "@webb-tools/bridges";
import { fetchComponentsFromFilePaths, PoseidonHasher, toFixedHex } from "@webb-tools/utils";
import { ethers } from "ethers";

require('dotenv').config();
const path = require('path');

// export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
// const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);

// const providerGanache = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:5002`);
// const walletGanache = new ethers.Wallet("0x0000000000000000000000000000000000000001", providerGanache);

async function run() {

  const hasher = new PoseidonHasher();
  const commitment = hasher.hash3(['0000020000000438', '0xe015a65c31d6a3cc42db76434caef90c65005857d5d5539a4ee950a250a3fe05', '0x13cdc3699e18591bc139d8f73e156baaeaea8156d6ea9e5eb69223ee0560e017']);
  const nullifierHash = hasher.hash(null, '0xe015a65c31d6a3cc42db76434caef90c65005857d5d5539a4ee950a250a3fe05', '0xe015a65c31d6a3cc42db76434caef90c65005857d5d5539a4ee950a250a3fe05')

  console.log('calculated hash: ', toFixedHex(commitment));
  console.log('nullifier hash: ', toFixedHex(nullifierHash));
}

run();

