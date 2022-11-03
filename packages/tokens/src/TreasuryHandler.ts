import {ethers} from "ethers";
import {
  TreasuryHandler as TreasuryHandlerContract,
  TreasuryHandler__factory,
} from "@webb-tools/contracts";

export class TreasuryHandler {
  contract: TreasuryHandlerContract;

  constructor(contract: TreasuryHandlerContract) {
    this.contract = contract;
  }

  public static async createTreasuryHandler(
    bridgeAddress: string,
    initResourceIds: string[],
    initContractAddresses: string[],
    deployer: ethers.Signer
  ) {
    const factory = new TreasuryHandler__factory(deployer);
    const contract = await factory.deploy(bridgeAddress, initResourceIds, initContractAddresses);
    await contract.deployed();

    const handler = new TreasuryHandler(contract);
    return handler;
  }

  public static async connect(handlerAddress: string, signer: ethers.Signer) {
    const handlerContract = TreasuryHandler__factory.connect(handlerAddress, signer);
    const handler = new TreasuryHandler(handlerContract);
    return handler;
  }
}
