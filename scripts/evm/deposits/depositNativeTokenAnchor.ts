import { ethers } from 'ethers';
import { Anchor } from '@webb-tools/fixed-bridge';

export async function depositNativeTokenAnchor(anchor: Anchor, destChainId: number, passedWallet: ethers.Signer) {
  const chainId = await passedWallet.getChainId();

  // There is enough to make the call.
  console.log(`depositing onto anchor ${anchor.contract.address} on: ${chainId}`);
  let deposit = await anchor.wrapAndDeposit('0x0000000000000000000000000000000000000000', destChainId);
  console.log(deposit);
  return deposit;
}
