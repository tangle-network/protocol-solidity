require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { depositAnchor } from './depositAnchor';
import { getAnchorLeaves } from './getAnchorLeaves';
import { parseNote } from './parseNote';
import { withdrawAnchor } from './withdrawAnchor';

let provider = new ethers.providers.JsonRpcProvider(`${process.env.ENDPOINT}`);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

async function run() {

  // const note = "webb-4-0xb8da45a0ae96ec52257c497b127c7c0c907676f09e8771fa436dc8d837a69d-0xf8af504162923bda03338484d7d670befbe0690f52454e3d6289553f7f08be";

  // const withdraw = await withdrawAnchor("0x5aCF1A99945AeC335309Ff0662504c8ebbf5c000", "0xD6F1E78B5F1Ebf8fF5a60C9d52eabFa73E5c5220", note, "0x48D41E139D3133F1879Ce5080b9C2CB4878332c2", wallet);
  // console.log(withdraw);

  const noteString = "webb-4-0x8c69492fbefd1542bfe460cf6926ed42559876f7815a39872da7c3fdbcc305-0x0f457e28607c4a458a78de8d2a6616baeaa01467242ad47de8d32cd09095ac"
  const deposit = parseNote(noteString);
  console.log(deposit);

  // const deposit = await depositAnchor("0x5aCF1A99945AeC335309Ff0662504c8ebbf5c000", "0xD6F1E78B5F1Ebf8fF5a60C9d52eabFa73E5c5220", wallet);
  // console.log(deposit);
}

run();
