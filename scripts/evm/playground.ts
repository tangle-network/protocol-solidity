require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { depositAnchor } from './depositAnchor';

let provider = new ethers.providers.JsonRpcProvider(`${process.env.ENDPOINT}`);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

async function run() {
  await depositAnchor('0x46936Fc663766A85ce598262c74d088671163d6b', '0x73FC2988D93DABe822E07BD07b0ad13C2bAAAEC6', wallet);
}

run();

