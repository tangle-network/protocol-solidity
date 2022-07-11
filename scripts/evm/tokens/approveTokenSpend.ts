// @ts-nocheck
import { ethers } from 'ethers';
import { ERC20 } from '../../../typechain/ERC20';
import { ERC20__factory } from '../../../typechain/factories/ERC20__factory';
require('dotenv').config({ path: '../.env' });

export async function approveTokenSpend(tokenAddress: string, spenderAddress: string, passedWallet: ethers.Signer) {
  const token: ERC20 = ERC20__factory.connect(tokenAddress, passedWallet);
  let tx = await token.approve(spenderAddress, '1000000000000000000000000000', {
    from: await passedWallet.getAddress(),
    gasLimit: '0x5B8D80',
  });
  await tx.wait();

  const name = await token.name();
  console.log(`The account: ${await passedWallet.getAddress()} approved ${spenderAddress} to spend ${name}`);
}
