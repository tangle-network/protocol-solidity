import { ethers } from 'ethers';
import { ERC20__factory } from '../../../typechain/factories/ERC20__factory';
require('dotenv').config();

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
