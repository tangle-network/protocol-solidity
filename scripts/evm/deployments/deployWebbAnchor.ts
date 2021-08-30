require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { WEBBAnchor2__factory } from '../../../typechain/factories/WEBBAnchor2__factory';
import { WEBBAnchor2 } from '../../../typechain/WEBBAnchor2';

export async function deployWEBBAnchor(
  verifierAddress: string,
  hasherAddress: string,
  denomination: ethers.BigNumberish,
  treeHeight: number,
  tokenAddress: string,
  bridgeAddress: string,
  adminAddress: string,
  handlerAddress: string,
  passedWallet: ethers.Signer
): Promise<WEBBAnchor2> {
  const WEBBAnchorFactory = new WEBBAnchor2__factory(passedWallet);
  let WEBBAnchorInstance = await WEBBAnchorFactory.deploy(
    verifierAddress,
    hasherAddress,
    denomination,
    treeHeight,
    await passedWallet.getChainId(),
    tokenAddress,
    bridgeAddress,
    adminAddress,
    handlerAddress,
    { gasLimit: '0x5B8D80' }
  );
  const WEBBAnchorAddress = await WEBBAnchorInstance.deployed();
  console.log(`Deployed WEBBAnchor: ${WEBBAnchorAddress.address}`);
  return WEBBAnchorInstance;
}
