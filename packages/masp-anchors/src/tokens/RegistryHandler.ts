import { ethers } from 'ethers';
import {
  RegistryHandler as RegistryHandlerContract,
  RegistryHandler__factory,
} from '@webb-tools/masp-anchor-contracts';
import { Deployer } from '@webb-tools/create2-utils';

export class RegistryHandler {
  contract: RegistryHandlerContract;

  constructor(contract: RegistryHandlerContract) {
    this.contract = contract;
  }

  public static async createRegistryHandler(
    bridgeAddress: string,
    initResourceIds: string[],
    initContractAddresses: string[],
    deployer: ethers.Signer
  ) {
    const factory = new RegistryHandler__factory(deployer);
    const contract = await factory.deploy(bridgeAddress, initResourceIds, initContractAddresses);
    await contract.deployed();

    const handler = new RegistryHandler(contract);
    return handler;
  }

  public static async create2RegistryHandler(
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
      RegistryHandler__factory,
      saltHex,
      signer,
      undefined,
      argTypes,
      args
    );

    const handler = new RegistryHandler(contract);
    return handler;
  }

  public static async connect(handlerAddress: string, signer: ethers.Signer) {
    const handlerContract = RegistryHandler__factory.connect(handlerAddress, signer);
    const handler = new RegistryHandler(handlerContract);
    return handler;
  }
}
