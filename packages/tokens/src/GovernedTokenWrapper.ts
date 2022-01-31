import { ethers } from 'ethers';
import { getChainIdType, toHex } from '@webb-tools/utils';
import { GovernedTokenWrapper as GovernedTokenWrapperContract, GovernedTokenWrapper__factory } from '@webb-tools/contracts';

export class GovernedTokenWrapper {
  contract: GovernedTokenWrapperContract;
  signer: ethers.Signer;
  
  constructor(
    contract: GovernedTokenWrapperContract,
    signer: ethers.Signer
  ) {
    this.contract = contract;
    this.signer = signer;
  }

  public static async createGovernedTokenWrapper(
    name: string,
    symbol: string,
    feeRecipient: string,
    governor: string,
    limit: string,
    isNativeAllowed: boolean,
    deployer: ethers.Signer
  ) {
    const factory = new GovernedTokenWrapper__factory(deployer);
    const contract = await factory.deploy(
      name,
      symbol,
      feeRecipient,
      governor,
      limit,
      isNativeAllowed
    );
    await contract.deployed();

    const handler = new GovernedTokenWrapper(contract, deployer);
    return handler;
  }

  public static connect(address: string, signer: ethers.Signer) {
    const contract = GovernedTokenWrapper__factory.connect(address, signer);
    const tokenWrapper = new GovernedTokenWrapper(contract, signer);
    return tokenWrapper;
  }

  public async grantMinterRole(address: string) {
    const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
    const tx = await this.contract.grantRole(MINTER_ROLE, address);
    await tx.wait();
    return;
  }

  public async createResourceId(): Promise<string> {
    return toHex(this.contract.address + toHex(getChainIdType(await this.signer.getChainId()), 6).substr(2), 32);
  }

  public async getAddTokenProposalData(tokenAddress: string): Promise<string> {
    //First 4 bytes of keccak hash is encoded function sig...
    const resourceID = await this.createResourceId();
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("add(address,uint256)")).slice(0, 10).padEnd(10, '0');
    const nonce = (await this.contract.proposalNonce()).add(1).toNumber();
  
    return '0x' +
    toHex(resourceID, 32).substr(2) + 
    functionSig.slice(2) +
    toHex(nonce,4).substr(2) + 
    tokenAddress.padEnd(42, '0').slice(2);
  }

  public async getRemoveTokenProposalData(tokenAddress: string): Promise<string> {
    //First 4 bytes of keccak hash is encoded function sig...
    const resourceID = await this.createResourceId();
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("remove(address,uint256)")).slice(0, 10).padEnd(10, '0');
    const nonce = (await this.contract.proposalNonce()).add(1).toNumber();

    return '0x' +
      toHex(resourceID, 32).substr(2) + 
      functionSig.slice(2) +
      toHex(nonce,4).substr(2) + 
      tokenAddress.padEnd(42, '0').slice(2);
  }

  public async getFeeProposalData(fee: number): Promise<string> {
    const resourceID = await this.createResourceId();
    const nonce = (await this.contract.proposalNonce()).add(1).toNumber();
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("setFee(uint8,uint256)")).slice(0, 10).padEnd(10, '0');
    const feeString = toHex(fee, 1);

    return '0x' +
      resourceID.substr(2) + 
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) + 
      feeString.slice(2);
  }
}
