import { ethers } from "ethers";
import { BridgeSide } from "@webb-tools/fixed-bridge"

export async function addRelayer(
  bridgeAddress: string,
  relayerAddress: string,
  adminSigner: ethers.Signer
) {
  const bridgeInstance = await BridgeSide.connect(bridgeAddress, adminSigner);
  const tx = await bridgeInstance.contract.adminAddRelayer(relayerAddress);
  const receipt = await tx.wait();
  console.log(receipt);
}
