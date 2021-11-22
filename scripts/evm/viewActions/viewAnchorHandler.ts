require('dotenv').config();
import { ethers } from 'ethers';
import Anchor from '../../../lib/darkwebb/Anchor';

export async function viewAnchorHandler(anchor: Anchor, passedWallet: ethers.Signer) {
  const anchorHandler = await anchor.contract.handler();
  console.log(anchorHandler);
  return anchorHandler;
}

