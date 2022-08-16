import { ethers } from 'ethers';
import { TreasuryHandler as TreasuryHandlerContract, TreasuryHandler__factory } from '@webb-tools/contracts';

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
    const deployTx = factory.getDeployTransaction(bridgeAddress, initResourceIds, initContractAddresses).data
    const gasEstimate = await factory.signer.estimateGas({ data: deployTx });
    const contract = await factory.deploy(bridgeAddress, initResourceIds, initContractAddresses, { gasLimit: gasEstimate });
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
