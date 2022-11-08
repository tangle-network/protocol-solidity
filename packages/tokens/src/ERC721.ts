import { ethers } from 'ethers';
import { ERC721 as ERC721Contract, ERC721__factory } from '@webb-tools/contracts';

class ERC721 {
  contract: ERC721Contract;

  constructor(contract: ERC721Contract) {
    this.contract = contract;
  }

  public static async createERC721(
    name: string,
    symbol: string,
    deployer: ethers.Signer
  ): Promise<ERC721> {
    const factory = new ERC721__factory(deployer);
    const contract = await factory.deploy(name, symbol);
    await contract.deployed();

    const handler = new ERC721(contract);
    return handler;
  }
}

export { ERC721 };
