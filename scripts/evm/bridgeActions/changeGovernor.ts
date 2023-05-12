import { ethers } from 'ethers';
import { SignatureBridgeSide } from '@webb-tools/vbridge';

export async function changeGovernor(
  bridgeAddress: string,
  newGovernor: string,
  currentGovernor: ethers.Wallet
) {
  const bridgeInstance = await SignatureBridgeSide.connectMocked(bridgeAddress, currentGovernor);
  const refreshNonce = await bridgeInstance.contract.refreshNonce();
  const tx = await bridgeInstance.transferOwnership(newGovernor, refreshNonce + 1);
  const receipt = await tx.wait();
  console.log(receipt);
}
