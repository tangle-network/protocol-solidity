require('dotenv').config();
import { ethers } from 'ethers';
import { MintableToken } from '@webb-tools/tokens';

export async function mintTokensToAddress(tokenAddress: string, recipient: string, admin: ethers.Signer) {
  const token = await MintableToken.tokenFromAddress(tokenAddress, admin);
  await token.mintTokens(recipient, "1000000000000000000000");
}
