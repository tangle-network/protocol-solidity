import { ethers } from "ethers";
import { AnchorHandler as AnchorHandlerContract} from '../../typechain/AnchorHandler';
import { AnchorHandler__factory } from "../../typechain/factories/AnchorHandler__factory";

class AnchorHandler {
  contract: AnchorHandlerContract;
  
  constructor(
    contract: AnchorHandlerContract
  ) {
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
}

export default AnchorHandler;
