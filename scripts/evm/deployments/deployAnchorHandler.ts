// @ts-nocheck
require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { AnchorHandler } from '../../../typechain/AnchorHandler';
import { AnchorHandler__factory } from '../../../typechain/factories/AnchorHandler__factory';

export async function deployAnchorHandler(
  bridgeAddress: string,
  initResourceIds: string[],
  initContractAddresses: string[],
  passedWallet: ethers.Signer
): Promise<AnchorHandler> {
  const anchorHandlerFactory = new AnchorHandler__factory(passedWallet);
  const anchorHandler = await anchorHandlerFactory.deploy(bridgeAddress, initResourceIds, initContractAddresses);
  await anchorHandler.deployed();
  console.log(`Deployed AnchorHandler: ${anchorHandler.address}`);

  return anchorHandler;
}
