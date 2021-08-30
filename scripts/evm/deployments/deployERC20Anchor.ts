// This script can be run without arguments to generate all new contracts or,
// the script can be run as `node deployWEBBAnchor <hasherAddress> <verifierAddress>`
//    to create a mixer with existing hasher and verifier contracts.

require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { Anchor2__factory } from '../../../typechain/factories/Anchor2__factory';
import { Anchor2 } from '../../../typechain/Anchor2';

let provider = new ethers.providers.JsonRpcProvider(`${process.env.ENDPOINT}`);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

export async function deployERC20Anchor(
  verifierAddress: string,
  hasherAddress: string,
  denomination: ethers.BigNumberish,
  treeHeight: number,
  tokenAddress: string,
  bridgeAddress: string,
  adminAddress: string,
  handlerAddress: string,
  passedWallet: ethers.Signer
): Promise<Anchor2> {
  const ERC20AnchorFactory = new Anchor2__factory(wallet);
  let ERC20Anchor = await ERC20AnchorFactory.deploy(
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
  const ERC20AnchorAddress = await ERC20Anchor.deployed();
  console.log(`Deployed ERC20Anchor: ${ERC20AnchorAddress.address}`);
  return ERC20Anchor;
}
