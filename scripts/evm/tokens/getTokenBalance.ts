import { ethers } from 'ethers';
import { ERC20__factory } from '../../../typechain/factories/ERC20__factory';
require('dotenv').config({ path: '../.env' });

// let shouldRun = true;
// let provider = new ethers.providers.JsonRpcProvider(`${process.env.ENDPOINT}`);

// if (!process.argv[2] || !ethers.utils.isAddress(process.argv[2])) {
//   console.log('token Address required as first parameter');
//   shouldRun = false;
// }

// if (!process.argv[3] || !ethers.utils.isAddress(process.argv[3])) {
//   console.log('checked Address required as second parameter');
//   shouldRun = false;
// }

// if (shouldRun) {
//   getTokenBalance(process.argv[2], process.argv[3], provider);
// }

export async function getTokenBalance(
  tokenAddress: string,
  checkAddress: string,
  passedProvider: ethers.providers.Provider
) {
  const token = ERC20__factory.connect(tokenAddress, passedProvider);

  const balance = await token.balanceOf(checkAddress);
  const name = await token.name();
  console.log(`The account: ${checkAddress} has a balance of ${balance} for ${name}`);

  return balance;
}
