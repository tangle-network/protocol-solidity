import { BigNumberish, ethers } from 'ethers';
import { toFixedHex, toHex, generateFunctionSigHash } from '@webb-tools/utils';
import { GovernedTokenWrapper as GovernedTokenWrapperContract, GovernedTokenWrapper__factory } from '@webb-tools/contracts';

export class GovernedTokenWrapper {
  contract: GovernedTokenWrapperContract;
  signer: ethers.Signer;
  
  ADD_TOKEN_SIGNATURE = "add(address,uint256)";
  REMOVE_TOKEN_SIGNATURE = "remove(address,uint256)";
  SET_FEE_SIGNATURE = "setFee(uint8,uint256)";
  RESCUE_TOKENS_SIGNATURE = "rescueTokens(address,address,uint256,uint256)";

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
    governor: string,
    limit: string,
    isNativeAllowed: boolean,
    deployer: ethers.Signer
  ) {
    const factory = new GovernedTokenWrapper__factory(deployer);
    const contract = await factory.deploy(
      name,
      symbol,
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
    return toHex(this.contract.address + toHex((await this.signer.getChainId()), 4).substr(2), 32);
  }

  public async getAddTokenProposalData(tokenAddress: string): Promise<string> {
    //First 4 bytes of keccak hash is encoded function sig...
    const resourceID = await this.createResourceId();
    const functionSig = generateFunctionSigHash(this.ADD_TOKEN_SIGNATURE)
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
    const functionSig = generateFunctionSigHash(this.REMOVE_TOKEN_SIGNATURE);
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
    const functionSig = generateFunctionSigHash(this.SET_FEE_SIGNATURE);
    const feeString = toHex(fee, 1);

    return '0x' +
      resourceID.substr(2) + 
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) + 
      feeString.slice(2);
  }

  public async getRescueTokensProposalData(tokenAddress: string, to: string, amountToRescue: BigNumberish) {
    const resourceID = await this.createResourceId();
    const nonce = (await this.contract.proposalNonce()).add(1).toNumber();
    const functionSig = generateFunctionSigHash(this.RESCUE_TOKENS_SIGNATURE);

    return '0x' +
      resourceID.substr(2) + 
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) + 
      tokenAddress.slice(2) +
      to.slice(2) +
      toFixedHex(amountToRescue).slice(2);
  }

}
