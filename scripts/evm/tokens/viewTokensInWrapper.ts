// @ts-nocheck
require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { GovernedTokenWrapper__factory } from '../../../typechain/factories/GovernedTokenWrapper__factory';

export async function viewTokensInWrapper(
  tokenWrapperAddress: string,
  passedProvider: ethers.providers.JsonRpcProvider
) {
  const governedTokenWrapper = GovernedTokenWrapper__factory.connect(tokenWrapperAddress, passedProvider);
  const tokens = await governedTokenWrapper.functions.getTokens();

  const allowedNative = await governedTokenWrapper.isNativeAllowed();
  console.log('Tokens in the wrapper: ');
  console.log(tokens);
  console.log('nativeAllowed? ', allowedNative);
}
