import { BigNumberish, ethers } from 'ethers';
import { Registry as RegistryContract, Registry__factory } from '@webb-tools/contracts';
import { generateFunctionSigHash, toFixedHex, toHex } from '@webb-tools/sdk-core';
import { getChainIdType } from '@webb-tools/utils';

export class Registry {
  contract: RegistryContract;
  signer: ethers.Signer;

  constructor(contract: RegistryContract, signer: ethers.Signer) {
    this.contract = contract;
    this.signer = signer;
  }

  public static async createRegistry(deployer: ethers.Signer) {
    const factory = new Registry__factory(deployer);
    const contract = await factory.deploy();
    await contract.deployed();

    const registry = new Registry(contract, deployer);
    return registry;
  }

  public static async connect(registryAddress: string, signer: ethers.Signer) {
    const registryContract = Registry__factory.connect(registryAddress, signer);
    const registry = new Registry(registryContract, signer);
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

  public REGISTER_FUNGIBLE_TOKEN_SIGNATURE = 'registerToken(uint32, address, uint256, string, string, bytes32, uint256, uint16, bool)';

  public REGISTER_NFT_TOKEN_SIGNATURE = 'registerNftToken(uint32, address, uint256, address, string, bytes32)';

  public async createResourceId(): Promise<string> {
    return toHex(
      this.contract.address + toHex(getChainIdType(await this.signer.getChainId()), 6).substr(2),
      32
    );
  }

  public async getRegisterFungibleTokenProposalData(
    tokenHandler: string,
    assetIdentifier: number,
    wrappedTokenName: string,
    wrappedTokenSymbol: string,
    salt: string,
    limit: BigNumberish,
    feePercentage: number,
    isNativeAllowed: boolean,
  ): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = generateFunctionSigHash(this.REGISTER_FUNGIBLE_TOKEN_SIGNATURE);
    const nonce = (await this.contract.proposalNonce()).add(1).toNumber();

    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).slice(2) +
      tokenHandler.padEnd(42, '0').slice(2) +
      toFixedHex(assetIdentifier).slice(2) + 
      toFixedHex(wrappedTokenName).slice(2) +
      toFixedHex(wrappedTokenSymbol).slice(2) +
      toFixedHex(salt).slice(2) +
      toFixedHex(limit).slice(2) +
      toFixedHex(feePercentage, 2).slice(2) +
      toFixedHex(isNativeAllowed ? 1 : 0, 1).slice(2)
    );
  }

  public async getRegisterNftTokenProposalData(
    tokenHandler: string,
    assetIdentifier: number,
    unwrappedNftAddress: string,
    salt: string,
    uri: string,
  ): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = generateFunctionSigHash(this.REGISTER_FUNGIBLE_TOKEN_SIGNATURE);
    const nonce = (await this.contract.proposalNonce()).add(1).toNumber();

    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).slice(2) +
      tokenHandler.padEnd(42, '0').slice(2) +
      toFixedHex(assetIdentifier).slice(2) + 
      toFixedHex(unwrappedNftAddress).slice(2) +
      toFixedHex(salt).slice(2) +
      toFixedHex(uri, 64).slice(2)
    );
  }
}
