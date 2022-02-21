import { ethers, Overrides } from "ethers";
import { SignatureBridgeSide } from "@webb-tools/bridges"

export async function changeGovernor(
  bridgeAddress: string,
  newGovernor: string,
  currentGovernor: ethers.Wallet,
  overrides?: Overrides
) {
  const bridgeInstance = await SignatureBridgeSide.connect(bridgeAddress, currentGovernor, currentGovernor);
  const refreshNonce = await bridgeInstance.contract.refreshNonce();
  const tx = await bridgeInstance.transferOwnership(newGovernor, refreshNonce+1, overrides || {});
  const receipt = await tx.wait();
  console.log(receipt);
}
