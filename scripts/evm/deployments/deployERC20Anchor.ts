// This script can be run without arguments to generate all new contracts or,
// the script can be run as `node deployWEBBAnchor <hasherAddress> <verifierAddress>`
//    to create a mixer with existing hasher and verifier contracts.

require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { FixedDepositAnchor__factory as Anchor__factory } from '../../../typechain/factories/FixedDepositAnchor__factory';
import { FixedDepositAnchor as Anchor } from '../../../typechain/FixedDepositAnchor';

export async function deployERC20Anchor(
  verifierAddress: string,
  hasherAddress: string,
  denomination: ethers.BigNumberish,
  treeHeight: number,
  tokenAddress: string,
  handlerAddress: string,
  passedWallet: ethers.Signer
): Promise<Anchor> {
  const ERC20AnchorFactory = new Anchor__factory(passedWallet);
  let ERC20Anchor = await ERC20AnchorFactory.deploy(
    handlerAddress,
    tokenAddress,
    verifierAddress,
    hasherAddress,
    denomination,
    treeHeight,
    2,
    { gasLimit: '0x5B8D80' }
  );
  const ERC20AnchorAddress = await ERC20Anchor.deployed();
  console.log(`Deployed ERC20Anchor: ${ERC20AnchorAddress.address}`);
  return ERC20Anchor;
}
