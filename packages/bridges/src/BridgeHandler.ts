import { ethers } from 'ethers';
import { BridgeHandler as BridgeHandlerContract, BridgeHandler__factory } from '@webb-tools/contracts';

export class BridgeHandler {
  contract: BridgeHandlerContract;
  
  constructor(
    contract: BridgeHandlerContract
  ) {
    this.contract = contract;
  }

  public static async createBridgeHandler(
    bridgeAddress: string,
    initResourceIds: string[],
    initContractAddresses: string[],
    deployer: ethers.Signer
  ) {
    const factory = new BridgeHandler__factory(deployer);
    const contract = await factory.deploy(bridgeAddress, initResourceIds, initContractAddresses);
    await contract.deployed();

    const handler = new BridgeHandler(contract);
    return handler;
  }

  public static async connect(
    handlerAddress: string,
    signer: ethers.Signer,
  ) {
    const handlerContract = BridgeHandler__factory.connect(handlerAddress, signer);
    const handler = new BridgeHandler(handlerContract);
    return handler;
  }
}
