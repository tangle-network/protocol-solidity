require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { LinkableAnchor__factory } from '../../typechain/factories/LinkableAnchor__factory';

export async function setLinkableAnchorHandler(
  anchorAddress: string,
  handlerAddress: string,
  passedWallet: ethers.Signer
) {
  const linkableAnchor = LinkableAnchor__factory.connect(anchorAddress, passedWallet);
  await linkableAnchor.setHandler(handlerAddress);
  console.log(`anchor at: ${anchorAddress} has handler set to: ${handlerAddress}`);
}
