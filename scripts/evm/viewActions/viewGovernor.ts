import { ethers, Overrides } from "ethers";
import { SignatureBridge__factory } from "@webb-tools/contracts"

export async function viewGovernor(
  bridgeAddress: string,
  passedWallet: ethers.Wallet,
  overrides?: Overrides
) {
  const bridgeInstance = await SignatureBridge__factory.connect(bridgeAddress, passedWallet);
  const governor = await bridgeInstance.governor();
  console.log('governor is: ', governor);
}