// @ts-nocheck
import { ethers } from 'ethers';
import Anchor from '../../../packages/bridges/Anchor';
import { AnchorDeposit } from '../../../packages/bridges/types';

export async function bridgedWithdrawErc20Token(
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
