// @ts-nocheck
import { ethers } from "ethers";
import { ERC20__factory } from "../../../typechain/factories/ERC20__factory";
require("dotenv").config({ path: "../.env" });

export async function getTokenAllowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  provider: ethers.providers.Provider
) {
  const token = ERC20__factory.connect(tokenAddress, provider);

  const balance = await token.allowance(ownerAddress, spenderAddress);
  const name = await token.name();
  console.log(
    `The account: ${ownerAddress} has already given ${spenderAddress} permission to spend ${balance} for ${name}`
  );

  return balance;
}
