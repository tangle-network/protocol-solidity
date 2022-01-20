import { ethers } from 'ethers';
import { Anchor, AnchorDeposit } from '../../../packages/bridges';
import { WithdrawalEvent } from '../../../packages/contracts/lib/AnchorBase'
import { ZkComponents } from '../../../packages/utils/lib';

export async function withdrawNativeToken(
  anchorAddress: string,
  anchorDeposit: AnchorDeposit,
  recipient: string,
  zkComponents: ZkComponents,
  passedWallet: ethers.Signer
): Promise<WithdrawalEvent> {
  const anchor = await Anchor.connect(anchorAddress, zkComponents, passedWallet);
  await anchor.update(5743545);

  const event = await anchor.withdrawAndUnwrap(anchorDeposit.deposit, anchorDeposit.originChainId, anchorDeposit.index, recipient, '0', BigInt(0), '0', '0x0000000000000000000000000000000000000000');
  return event;
}
