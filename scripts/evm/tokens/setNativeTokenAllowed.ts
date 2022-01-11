import { ethers } from "ethers";
import { GovernedTokenWrapper } from "@webb-tools/tokens"

export async function setNativeTokenAllowed(
  webbTokenAddress: string,
  deployer: ethers.Signer
) {
  const tokenInstance = await GovernedTokenWrapper.connect(webbTokenAddress, deployer);
  const tx = await tokenInstance.contract.setNativeAllowed(true);
  const receipt = await tx.wait();
  console.log(receipt);
}
