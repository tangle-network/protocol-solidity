import { ethers } from 'ethers';
import {
  MultiFungibleTokenManager as MultiFungibleTokenManagerContract,
  MultiFungibleTokenManager__factory,
} from '@webb-tools/contracts';

export class MultiFungibleTokenManager {
  contract: MultiFungibleTokenManagerContract;

  constructor(
    contract: MultiFungibleTokenManagerContract,
) {
    this.contract = contract;
  }

  public static async createMultiFungibleTokenManager(
    deployer: ethers.Signer
  ) {
    const factory = new MultiFungibleTokenManager__factory(deployer);
    const contract = await factory.deploy();
    await contract.deployed();

    const manager = new MultiFungibleTokenManager(contract);
    return manager;
  }

  public static async connect(managerAddress: string, signer: ethers.Signer) {
    const managerContract = MultiFungibleTokenManager__factory.connect(managerAddress, signer);
    const manager = new MultiFungibleTokenManager(managerContract);
    return manager;
  }

  public async setRegistry(registry: string) {
    const tx = await this.contract.setRegistry(registry);
    await tx.wait();
  }
}
