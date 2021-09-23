require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { depositAnchor } from './depositAnchor';

let provider = new ethers.providers.JsonRpcProvider(`${process.env.ENDPOINT}`);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

async function run() {

  

}

run();

