import { ethers } from 'ethers';
import {
  TokenWrapperHandler as TokenWrapperHandlerContract,
  TokenWrapperHandler__factory,
} from '@webb-tools/contracts';
import { Deployer } from '@webb-tools/create2-utils';

export class TokenWrapperHandler {
  contract: TokenWrapperHandlerContract;

  constructor(contract: TokenWrapperHandlerContract) {
    this.contract = contract;
  }

  public static async createTokenWrapperHandler(
    bridgeAddress: string,
    initResourceIds: string[],
    initContractAddresses: string[],
    deployer: ethers.Signer
  ) {
    const factory = new TokenWrapperHandler__factory(deployer);
    const contract = await factory.deploy(bridgeAddress, initResourceIds, initContractAddresses);
    await contract.deployed();

    const handler = new TokenWrapperHandler(contract);
    return handler;
  }

  public static async create2TokenWrapperHandler(
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
      TokenWrapperHandler__factory,
      saltHex,
      signer,
      undefined,
      argTypes,
      args
    );
    const handler = new TokenWrapperHandler(contract);
    return handler;
  }

  public static async connect(handlerAddress: string, signer: ethers.Signer) {
    const handlerContract = TokenWrapperHandler__factory.connect(handlerAddress, signer);
    const handler = new TokenWrapperHandler(handlerContract);
    return handler;
  }
}
