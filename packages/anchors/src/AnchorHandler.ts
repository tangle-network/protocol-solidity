import { ethers } from 'ethers';
import {
  AnchorHandler as AnchorHandlerContract,
  AnchorHandler__factory,
} from '@webb-tools/contracts';
import { Deployer } from './Deployer';

export class AnchorHandler {
  contract: AnchorHandlerContract;

  constructor(contract: AnchorHandlerContract) {
    this.contract = contract;
  }

  public static async createAnchorHandler(
    bridgeAddress: string,
    initResourceIds: string[],
    initContractAddresses: string[],
    deployer: ethers.Signer
  ) {
    const factory = new AnchorHandler__factory(deployer);
    const contract = await factory.deploy(bridgeAddress, initResourceIds, initContractAddresses);
    await contract.deployed();

    const handler = new AnchorHandler(contract);
    return handler;
  }

  public static async create2AnchorHandler(
    bridgeAddress: string,
    initResourceIds: string[],
    initContractAddresses: string[],
    deployer: Deployer,
    saltHex: string,
    signer: ethers.Signer
  ) {
    const argTypes = ['address', 'bytes32[]', 'address[]'];
    const args = [bridgeAddress, initResourceIds, initContractAddresses];
    const { contract: contract } = await deployer.deploy(
      AnchorHandler__factory,
      saltHex,
      signer,
      undefined,
      argTypes,
      args
    );

    const handler = new AnchorHandler(contract);
    return handler;
  }

  public static async connect(handlerAddress: string, signer: ethers.Signer) {
    const handlerContract = AnchorHandler__factory.connect(handlerAddress, signer);
    const handler = new AnchorHandler(handlerContract);
    return handler;
  }
}
