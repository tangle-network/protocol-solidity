import { BigNumberish, ethers } from 'ethers';
import { getChainIdType } from '@webb-tools/utils';
import { toHex, generateFunctionSigHash } from '@webb-tools/sdk-core';
import {
  FungibleTokenWrapper as FungibleTokenWrapperContract,
  FungibleTokenWrapper__factory,
} from '@webb-tools/contracts';
import { assert } from 'chai';
import { Deployer } from '@webb-tools/anchors';

export class FungibleTokenWrapper {
  contract: FungibleTokenWrapperContract;
  signer: ethers.Signer;

  ADD_TOKEN_SIGNATURE = 'add(address,uint32)';
  REMOVE_TOKEN_SIGNATURE = 'remove(address,uint32)';
  SET_FEE_SIGNATURE = 'setFee(uint16,uint32)';
  FEE_RECIPIENT_SIGNATURE = 'setFeeRecipient(address,uint32)';

  constructor(contract: FungibleTokenWrapperContract, signer: ethers.Signer) {
    this.contract = contract;
    this.signer = signer;
  }

  public static async createFungibleTokenWrapper(
    name: string,
    symbol: string,
    feePercentage: number,
    feeRecipient: string,
    handler: string,
    limit: BigNumberish,
    isNativeAllowed: boolean,
    deployer: ethers.Signer
  ) {
    assert(feePercentage <= 10_000, 'feePercentage should be less than 10_000');
    const factory = new FungibleTokenWrapper__factory(deployer);
    const contract: FungibleTokenWrapperContract = await factory.deploy(name, symbol);
    await contract.deployed();
    // Initialize immediately after deployment as we use an intializer now
    await contract.initialize(
      feePercentage,
      feeRecipient,
      handler,
      limit,
      isNativeAllowed,
      await deployer.getAddress()
    );
    const tokenWrapper = new FungibleTokenWrapper(contract, deployer);

    return tokenWrapper;
  }

  public static async create2FungibleTokenWrapper(
    name: string,
    symbol: string,
    feePercentage: number,
    feeRecipient: string,
    handler: string,
    limit: string,
    isNativeAllowed: boolean,
    deployer: Deployer,
    saltHex: string,
    signer: ethers.Signer
  ) {
    assert(feePercentage <= 10_000, 'feePercentage should be less than 10_000');

    const argTypes = ['string', 'string'];
    const args = [name, symbol];
    const { contract: contract } = await deployer.deploy(
      FungibleTokenWrapper__factory,
      saltHex,
      signer,
      undefined,
      argTypes,
      args
    );

    // Initialize immediately after deployment as we use an intializer now
    await contract.initialize(feePercentage, feeRecipient, handler, limit, isNativeAllowed);
    const tokenWrapper = new FungibleTokenWrapper(contract, signer);
    return tokenWrapper;
  }

  public static connect(address: string, signer: ethers.Signer) {
    const contract = FungibleTokenWrapper__factory.connect(address, signer);
    const tokenWrapper = new FungibleTokenWrapper(contract, signer);
    return tokenWrapper;
  }

  public async grantMinterRole(address: string): Promise<ethers.ContractReceipt> {
    const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
    const tx = await this.contract.grantRole(MINTER_ROLE, address);
    const receipt = await tx.wait();
    return receipt;
  }

  public async approve(address: string, amount: BigNumberish): Promise<ethers.ContractReceipt> {
    const tx = await this.contract.approve(address, amount);
    const receipt = await tx.wait();
    return receipt;
  }

  public async wrap(tokenAddress: string, amount: BigNumberish): Promise<ethers.ContractReceipt> {
    const tx = await this.contract.wrap(tokenAddress, amount);
    const receipt = await tx.wait();
    return receipt;
  }

  public async unwrap(tokenAddress: string, amount: BigNumberish): Promise<ethers.ContractReceipt> {
    const tx = await this.contract.unwrap(tokenAddress, amount);
    const receipt = await tx.wait();
    return receipt;
  }

  public async isNativeAllowed(): Promise<boolean> {
    return await this.contract.isNativeAllowed();
  }

  public async canWrap(address: string): Promise<boolean> {
    return await this.contract.isValidToken(address);
  }

  public async getFeeRecipientAddress(): Promise<string> {
    return await this.contract.feeRecipient();
  }

  public async createResourceId(): Promise<string> {
    return toHex(
      this.contract.address + toHex(getChainIdType(await this.signer.getChainId()), 6).substr(2),
      32
    );
  }

  public async getAddTokenProposalData(tokenAddress: string): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = generateFunctionSigHash(this.ADD_TOKEN_SIGNATURE);
    const nonce = (await this.contract.proposalNonce()).add(1).toNumber();

    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) +
      tokenAddress.padEnd(42, '0').slice(2)
    );
  }

  public async getRemoveTokenProposalData(tokenAddress: string): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = generateFunctionSigHash(this.REMOVE_TOKEN_SIGNATURE);
    const nonce = (await this.contract.proposalNonce()).add(1).toNumber();

    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) +
      tokenAddress.padEnd(42, '0').slice(2)
    );
  }

  public async getFeeProposalData(fee: number): Promise<string> {
    const resourceID = await this.createResourceId();
    const nonce = (await this.contract.proposalNonce()).add(1).toNumber();
    const functionSig = generateFunctionSigHash(this.SET_FEE_SIGNATURE);
    const feeString = toHex(fee, 2);

    return (
      '0x' +
      resourceID.substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) +
      feeString.slice(2)
    );
  }

  public async getFeeRecipientProposalData(feeRecipient: string): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = generateFunctionSigHash(this.FEE_RECIPIENT_SIGNATURE);
    const nonce = (await this.contract.proposalNonce()).add(1).toNumber();

    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) +
      feeRecipient.padEnd(42, '0').slice(2)
    );
  }
}
