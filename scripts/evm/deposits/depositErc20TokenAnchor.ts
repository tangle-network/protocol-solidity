// @ts-nocheck
import { ethers } from 'ethers';
import Anchor from '../../../packages/bridges/Anchor';
import { approveTokenSpend } from '../tokens/approveTokenSpend';
import { getTokenAllowance } from '../tokens/getTokenAllowance';

export async function depositErc20TokenAnchor(anchor: Anchor, tokenAddress: string, destChainId: number, passedWallet: ethers.Signer) {
  const chainId = await passedWallet.getChainId();
  const walletAddress = await passedWallet.getAddress();

  const anchorDenomination = await anchor.contract.denomination();
  console.log(`anchor denomination: ${anchorDenomination}`);
  const tokenAllowance = await getTokenAllowance(tokenAddress, walletAddress, anchor.contract.address, passedWallet.provider!);
  const tokenBig = ethers.BigNumber.from(tokenAllowance);
  console.log(`tokenBig: ${tokenBig}`);

  if (tokenBig.lt(anchorDenomination)) {
    // approve (infinite) tokens for the anchor
    console.log('less than approved amount');
    let tx = await approveTokenSpend(tokenAddress, anchor.contract.address, passedWallet);
  }

  // There is enough to make the call.
  console.log(`depositing onto anchor ${anchor.contract.address} on: ${chainId}`);
  let deposit = await anchor.deposit(destChainId);
  console.log(deposit);
  return deposit;
}
