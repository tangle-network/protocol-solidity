require('dotenv').config();
import { ethers } from 'ethers';
import { setNativeTokenAllowed } from './setNativeTokenAllowed';

const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
const providerRopsten = new ethers.providers.JsonRpcProvider(`https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletRopsten = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRopsten);
const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);
const providerOptimism = new ethers.providers.JsonRpcProvider('https://kovan.optimism.io');
const walletOptimism = new ethers.Wallet(process.env.PRIVATE_KEY!, providerOptimism);
const providerArbitrum = new ethers.providers.JsonRpcProvider('https://rinkeby.arbitrum.io/rpc');
const walletArbitrum = new ethers.Wallet(process.env.PRIVATE_KEY!, providerArbitrum);

async function run() { 
  await setNativeTokenAllowed('0x4e7D4BEe028655F2865d9D147cF7B609c516d39C', walletRinkeby);
  await setNativeTokenAllowed('0x105779076d17FAe5EAADF010CA677475549F49E4', walletRopsten);
  await setNativeTokenAllowed('0x5257c558c246311552A824c491285667B3a445a2', walletGoerli);
  await setNativeTokenAllowed('0xEAF873F1F6c91fEf73d4839b5fC7954554BBE518', walletOptimism);
  await setNativeTokenAllowed('0xD6F1E78B5F1Ebf8fF5a60C9d52eabFa73E5c5220', walletArbitrum);
}

run();
