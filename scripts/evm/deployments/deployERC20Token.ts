import { ethers } from 'ethers';
import { ERC20 } from '../../../typechain/ERC20';
require('dotenv').config({ path: '../.env' });
import { ERC20Mock__factory } from '../../../typechain/factories/ERC20Mock__factory';

export async function deployERC20(passedWallet: ethers.Signer): Promise<ERC20> {
  const erc20Factory = new ERC20Mock__factory(passedWallet);
  const erc20 = await erc20Factory.deploy();
  console.log(`erc20 token deployed at: ${erc20.address}`);
  await erc20.deployed();

  // mint some token for the sender
  await erc20.mint(await passedWallet.getAddress(), '1000000000000000000000000');

  return erc20;
}
