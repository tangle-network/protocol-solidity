require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { IMintableCompToken__factory } from '../../../typechain/factories/IMintableCompToken__factory';

export async function mintCompTokens(
  tokenAddress: string,
  userAddress: string,
  denomination: ethers.BigNumberish,
  passedWallet: ethers.Signer
) {
  const webbTokenContract = IMintableCompToken__factory.connect(tokenAddress, passedWallet);
  await webbTokenContract.mint(userAddress, ethers.BigNumber.from(denomination));
  console.log(`token at: ${tokenAddress} minted 100,000 to: ${userAddress}`);
}
