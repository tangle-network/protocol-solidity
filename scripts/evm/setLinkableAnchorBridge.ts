require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { LinkableAnchor2__factory } from '../../typechain/factories/LinkableAnchor2__factory';

export async function setLinkableAnchorBridge(
  anchorAddress: string,
  bridgeAddress: string,
  passedWallet: ethers.Signer
) {
  const linkableAnchor = LinkableAnchor2__factory.connect(anchorAddress, passedWallet);
  await linkableAnchor.setBridge(bridgeAddress);
  console.log(`anchor at: ${anchorAddress} has bridge set to: ${bridgeAddress}`);
}
