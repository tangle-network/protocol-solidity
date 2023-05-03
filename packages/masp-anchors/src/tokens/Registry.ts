import { BigNumberish, ethers } from 'ethers';
import { Registry as RegistryContract, Registry__factory } from '@webb-tools/masp-anchor-contracts';
import { generateFunctionSigHash, toHex } from '@webb-tools/sdk-core';
import { getChainIdType } from '@webb-tools/utils';

export class Registry {
  contract: RegistryContract;
  signer: ethers.Signer;
  REGISTER_FUNGIBLE_TOKEN_SIGNATURE =
    'registerToken(uint32,address,uint256,string,string,bytes32,uint256,uint16,bool)';
  REGISTER_NFT_TOKEN_SIGNATURE =
    'registerNftToken(uint32,address,uint256,address,string,string,bytes32)';

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
    name: string,
    symbol: string,
    salt: string
  ) {
    const tx = await this.contract.registerNftToken(
      nonce,
      tokenHandler,
      assetIdentifier,
      unwrappedNftAddress,
      name,
      symbol,
      salt,
      { gasLimit: '0x5B8D80' }
    );

    await tx.wait();
  }

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
    limit: string,
    feePercentage: number,
    isNativeAllowed: boolean
  ) {
    const resourceID = await this.createResourceId();
    const nonce = (await this.contract.proposalNonce()).add(1);
    const functionSig = generateFunctionSigHash(this.REGISTER_FUNGIBLE_TOKEN_SIGNATURE);
    return (
      '0x' +
      toHex(resourceID, 32).slice(2) +
      functionSig.slice(2) +
      toHex(Number(nonce), 4).slice(2) +
      toHex(tokenHandler, 20).slice(2) +
      toHex(assetIdentifier, 32).slice(2) +
      toHex(wrappedTokenName, 32).slice(2) +
      toHex(wrappedTokenSymbol, 32).slice(2) +
      toHex(salt, 32).slice(2) +
      toHex(limit, 32).slice(2) +
      toHex(feePercentage, 2).slice(2) +
      toHex(isNativeAllowed ? 1 : 0, 1).slice(2)
    );
  }

  public async getRegisterNftTokenProposalData(
    tokenHandler: string,
    assetIdentifier: number,
    unwrappedNftAddress: string,
    salt: string,
    name: string,
    symbol: string
  ) {
    const resourceID = await this.createResourceId();
    const nonce = (await this.contract.proposalNonce()).add(1);
    const functionSig = generateFunctionSigHash(this.REGISTER_NFT_TOKEN_SIGNATURE);
    return (
      '0x' +
      toHex(resourceID, 32).slice(2) +
      functionSig.slice(2) +
      toHex(Number(nonce), 4).slice(2) +
      toHex(tokenHandler, 20).slice(2) +
      toHex(assetIdentifier, 32).slice(2) +
      toHex(unwrappedNftAddress, 20).slice(2) +
      toHex(salt, 32).slice(2) +
      toHex(name, 32).slice(2) +
      toHex(symbol, 32).slice(2)
    );
  }
}
