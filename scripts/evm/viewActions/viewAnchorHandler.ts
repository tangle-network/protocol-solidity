require('dotenv').config();
import { ethers } from 'ethers';
import { Anchor } from '@webb-tools/anchors';

export async function viewAnchorHandler(anchor: Anchor, passedWallet: ethers.Signer) {
  const anchorHandler = await anchor.contract.handler();
  console.log(anchorHandler);
  return anchorHandler;
}

