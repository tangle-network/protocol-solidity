import { ethers } from 'ethers';
import GovernedTokenWrapper from '../../../lib/darkwebb/GovernedTokenWrapper';

export async function wrapToken(tokenToWrapAddress: string, amount: ethers.BigNumberish, tokenWrapperContractAddress: string, passedWallet: ethers.Signer) {
  const tokenWrapperContract = GovernedTokenWrapper.connect(tokenWrapperContractAddress, passedWallet);
  const tx = await tokenWrapperContract.contract.wrap(tokenToWrapAddress, amount);
  const receipt = await tx.wait();
}
