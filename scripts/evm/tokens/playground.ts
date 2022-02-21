require('dotenv').config();
import { getTokenBalance } from './getTokenBalance'
import { ethers } from 'ethers';


const providerAthena = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:5002`);
const walletAthena = new ethers.Wallet("0x0000000000000000000000000000000000000001", providerAthena);

async function run() { 
  
  const tokenBalance = await getTokenBalance('0xD30C8839c1145609E564b986F667b273Ddcb8496', '0x7Bb1Af8D06495E85DDC1e0c49111C9E0Ab50266E', providerAthena)
  console.log('recipient has a balance of: ', tokenBalance);

}

run();
