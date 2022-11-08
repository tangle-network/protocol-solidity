import { ethers } from 'ethers';
import { ERC1155 as ERC1155Contract, ERC1155__factory } from '@webb-tools/contracts';

class ERC1155 {
  contract: ERC1155Contract;

  constructor(contract: ERC1155Contract) {
    this.contract = contract;
  }

  public static async createERC1155(uri: string, deployer: ethers.Signer): Promise<ERC1155> {
    const factory = new ERC1155__factory(deployer);
    const contract = await factory.deploy(uri);
    await contract.deployed();

    const handler = new ERC1155(contract);
    return handler;
  }
}

export { ERC1155 };
