require('dotenv').config();
import { ethers } from 'ethers';
import { mintCompTokens } from './tokens/mintCompTokens';
import { getTokenBalance } from './tokens/getTokenBalance';
import { deployERC20 } from './deployments/deployERC20Token';
import { toFixedHex } from '../../lib/darkwebb/utils';

let providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);

let providerRinkeby = new ethers.providers.JsonRpcProvider(`https://api.s0.b.hmny.io`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);

let providerRinkeby = new ethers.providers.JsonRpcProvider(`https://api.s1.b.hmny.io`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);

let providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);

async function run() {
  // const tokenTx = await mintCompTokens('0x7Cec2Bf7D9c4C3C96Da8a0BfeBAB1E84b8212394', "0xe219d359eF20932FB67aec166E9F7207fEe29907", '1000000000000000000000', wallet);
  // const tokenTx = await mintCompTokens('0x9d609F54536Cef34f5F612BD976ca632F1fa208E', "0x3396173a181fa10754E33bDf6BA2aAFb3b065238", '1000000000000000000000', wallet);
  // const tokenTx = await getTokenBalance('0x9d609F54536Cef34f5F612BD976ca632F1fa208E', '0xc2eb6995266649D2C8bbD228fc41e232C8BEca3C', provider);
  // const tokenTx = await getTokenBalance('0x7Cec2Bf7D9c4C3C96Da8a0BfeBAB1E84b8212394', '0xe219d359eF20932FB67aec166E9F7207fEe29907', provider);

  // create the tokens to bridge together
  const erc20Rinkeby = await deployERC20(walletRinkeby);
  console.log(erc20Rinkeby.address);



}

run();

