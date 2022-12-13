import { BigNumberish, ethers } from 'ethers';
import { Registry as RegistryContract, Registry__factory } from '@webb-tools/contracts';

export class Registry {
  contract: RegistryContract;

  constructor(contract: RegistryContract) {
    this.contract = contract;
  }

  public static async createRegistry(deployer: ethers.Signer) {
    const factory = new Registry__factory(deployer);
    const contract = await factory.deploy();
    await contract.deployed();

    const registry = new Registry(contract);
    return registry;
  }

  public static async connect(registryAddress: string, signer: ethers.Signer) {
    const registryContract = Registry__factory.connect(registryAddress, signer);
    const registry = new Registry(registryContract);
    return registry;
  }

  public async initialize(
    fungibleTokenManager: string,
    nonFungibleTokenManager: string,
    registryHandler: string,
    masterFeeRecipient: string,
    maspVAnchor: string
  ) {
    const tx = await this.contract.initialize(
      fungibleTokenManager,
      nonFungibleTokenManager,
      registryHandler,
      masterFeeRecipient,
      maspVAnchor,
      { gasLimit: '0x5B8D80' }
    );
    await tx.wait();
  }

  public async registerToken(
    nonce: number,
    tokenHandler: string,
    assetIdentifier: number,
    wrappedTokenName: string,
    wrappedTokenSymbol: string,
    salt: string,
    limit: BigNumberish,
    feePercentage: number,
    isNativeAllowed: boolean
  ) {
    const tx = await this.contract.registerToken(
      nonce,
      tokenHandler,
      assetIdentifier,
      wrappedTokenName,
      wrappedTokenSymbol,
      salt,
      limit,
      feePercentage,
      isNativeAllowed,
      { gasLimit: '0x5B8D80' }
    );
    await tx.wait();
  }

  public async registerNftToken(
    nonce: number,
    tokenHandler: string,
    assetIdentifier: number,
    unwrappedNftAddress: string,
    wrappedTokenURI: string,
    salt: string
  ) {
    const tx = await this.contract.registerNftToken(
      nonce,
      tokenHandler,
      assetIdentifier,
      unwrappedNftAddress,
      wrappedTokenURI,
      salt,
      { gasLimit: '0x5B8D80' }
    );

    await tx.wait();
  }
}
