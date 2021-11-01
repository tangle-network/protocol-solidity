require('dotenv').config();
import { ethers } from 'ethers';
import Anchor from '../../lib/darkwebb/Anchor';
import { AnchorDeposit } from '../../lib/darkwebb/Anchor';
import { depositNativeTokenAnchor } from './deposits/depositNativeTokenAnchor';
import { withdrawNativeToken } from './withdrawals/withdrawNativeToken';

const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);

// const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
// const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);

// const providerHarmony0 = new ethers.providers.JsonRpcProvider(`https://api.s0.b.hmny.io`);
// const walletHarmony0 = new ethers.Wallet(process.env.PRIVATE_KEY!, providerHarmony0);

async function run() {
  const deposit = await depositNativeTokenAnchor('0x33EAD0AE289f172E00BDD2e5c39BDF5b18F9d63A', 5, walletRinkeby);
  console.log(deposit);
}

run();

