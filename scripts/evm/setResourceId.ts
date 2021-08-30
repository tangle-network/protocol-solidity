require('dotenv').config({ path: '../.env' });
const helpers = require('../../test/helpers');
import { ethers } from 'ethers';
import { Bridge__factory } from '../../typechain/factories/Bridge__factory';

export async function setResourceId(
  bridgeAddress: string,
  anchorAddress: string,
  handlerAddress: string,
  passedWallet: ethers.Signer
) {
  const bridgeContract = Bridge__factory.connect(bridgeAddress, passedWallet);
  const chainId = await passedWallet.getChainId();
  const resourceId = helpers.createResourceID(anchorAddress, chainId);

  let tx = await bridgeContract.adminSetResource(handlerAddress, resourceId, anchorAddress);
  await tx.wait();
}
