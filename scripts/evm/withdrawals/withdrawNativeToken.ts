import { ethers } from 'ethers';
import Anchor, { AnchorDeposit } from '../../../lib/darkwebb/Anchor';

export async function withdrawNativeToken(
  anchorAddress: string,
  anchorDeposit: AnchorDeposit,
  recipient: string,
  passedWallet: ethers.Signer
) {
  const anchor = await Anchor.connect(anchorAddress, passedWallet);
  await anchor.update(5743545);

  const event = await anchor.withdrawAndUnwrap(anchorDeposit.deposit, anchorDeposit.originChainId, anchorDeposit.index, recipient, '0', BigInt(0), '0', '0x0000000000000000000000000000000000000000');
  return event;
}
