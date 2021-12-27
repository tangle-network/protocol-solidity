import { ethers } from "ethers";
import { LinkableTreeHandler as LinkableTreeHandlerContract, LinkableTreeHandler__factory } from '../../../typechain';

export class LinkableTreeHandler {
  contract: LinkableTreeHandlerContract;
  
  constructor(
    contract: LinkableTreeHandlerContract
  ) {
    this.contract = contract;
  }

  public static async createLinkableTreeHandler(
    bridgeAddress: string,
    initResourceIds: string[],
    initContractAddresses: string[],
    deployer: ethers.Signer
  ) {
    const factory = new LinkableTreeHandler__factory(deployer);
    const contract = await factory.deploy(bridgeAddress, initResourceIds, initContractAddresses);
    await contract.deployed();

    const handler = new LinkableTreeHandler(contract);
    return handler;
  }

  public static async connect(
    handlerAddress: string,
    signer: ethers.Signer,
  ) {
    const handlerContract = LinkableTreeHandler__factory.connect(handlerAddress, signer);
    const handler = new LinkableTreeHandler(handlerContract);
    return handler;
  }
}
