import { ethers } from 'ethers';
import { Anchor, AnchorDeposit } from '@webb-tools/fixed-bridge';

export async function bridgedWithdrawWebbToken(
  anchor: Anchor,
  merkleProof: any,
  anchorDeposit: AnchorDeposit,
  recipient: string,
) {
  const event = await anchor.bridgedWithdraw(
    anchorDeposit,
    merkleProof,
    recipient,
    '0x0000000000000000000000000000000000000000',
    '0',
    '0',
    '0'
  );
  return event;
}
