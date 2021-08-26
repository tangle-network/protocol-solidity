require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { Bridge } from '../../../typechain/Bridge';
import { Bridge__factory } from '../../../typechain/factories/Bridge__factory';

export async function deployWebbBridge(
  chainId: ethers.BigNumberish,
  initialRelayers: string[],
  initialRelayerThreshold: ethers.BigNumberish,
  fee: ethers.BigNumberish,
  expiry: ethers.BigNumberish,
  passedWallet: ethers.Signer,
): Promise<Bridge> {
  const bridgeFactory = new Bridge__factory(passedWallet);
  const deployedBridge = await bridgeFactory.deploy(chainId, initialRelayers, initialRelayerThreshold, fee, expiry);
  await deployedBridge.deployed();
  console.log(`Deployed Bridge: ${deployedBridge.address}`);
  return deployedBridge;
}
