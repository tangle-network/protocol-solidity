import { ethers } from 'ethers';
import { TokenWrapperHandler as TokenWrapperHandlerContract, TokenWrapperHandler__factory } from '@webb-tools/contracts';

export class TokenWrapperHandler {
  contract: TokenWrapperHandlerContract;
  
  constructor(
    contract: TokenWrapperHandlerContract
  ) {
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

  public static async connect(
    handlerAddress: string,
    signer: ethers.Signer,
  ) {
    const handlerContract = TokenWrapperHandler__factory.connect(handlerAddress, signer);
    const handler = new TokenWrapperHandler(handlerContract);
    return handler;
  }
}
