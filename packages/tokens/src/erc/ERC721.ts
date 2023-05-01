import { ethers } from 'ethers';
import { ERC721Mintable as ERC721Contract, ERC721Mintable__factory } from '@webb-tools/contracts';

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
    const factory = new ERC721Mintable__factory(deployer);
    const contract = await factory.deploy(name, symbol);
    await contract.deployed();

    const handler = new ERC721(contract);
    return handler;
  }

  public static async connect(tokenAddress: string, signer: ethers.Signer) {
    const tokenContract = ERC721Mintable__factory.connect(tokenAddress, signer);
    const token = new ERC721(tokenContract);
    return token;
  }

  public async mint(to: string, tokenId: number) {
    const tx = await this.contract.mint(to, tokenId);
    await tx.wait();
  }

  public async approve(to: string, tokenId: number) {
    const tx = await this.contract.approve(to, tokenId);
    await tx.wait();
  }

  public async transferFrom(from: string, to: string, tokenId: number) {
    const tx = await this.contract.transferFrom(from, to, tokenId);
    await tx.wait();
  }
}

export { ERC721 };
