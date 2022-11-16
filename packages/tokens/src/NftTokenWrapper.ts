import { ethers } from 'ethers';
import {
  NftTokenWrapper as NftTokenWrapperContract,
  NftTokenWrapper__factory,
} from '@webb-tools/contracts';

export class NftTokenWrapper {
  contract: NftTokenWrapperContract;

  constructor(
    contract: NftTokenWrapperContract,
) {
    this.contract = contract;
  }

  public static async createNftTokenWrapper(
    uri: string,
    tokenHandler: string,
    deployer: ethers.Signer
  ) {
    const factory = new NftTokenWrapper__factory(deployer);
    const contract = await factory.deploy(uri);
    await contract.deployed();

    const tx = await contract.initialize(
        tokenHandler
    );
    await tx.wait();

    const tokenWrapper = new NftTokenWrapper(
        contract,
    );
    return tokenWrapper;
  }

  public static async connect(tokenWrapperAddress: string, signer: ethers.Signer) {
    const tokenWrapperContract = NftTokenWrapper__factory.connect(tokenWrapperAddress, signer);
    const tokenWrapper = new NftTokenWrapper(tokenWrapperContract);
    return tokenWrapper;
  }

  public async wrap721(tokenId: number, tokenAddress: string) {
    const tx = await this.contract.wrap721(tokenId, tokenAddress);
    await tx.wait();
  }

  public async unwrap721(tokenId: number, tokenAddress: string) {
    const tx = await this.contract.unwrap721(tokenId, tokenAddress);
    await tx.wait();
  }
}
