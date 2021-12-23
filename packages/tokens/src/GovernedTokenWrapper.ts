import { ethers } from "ethers";
import { toFixedHex, toHex } from '@webb-tools/utils';
import { GovernedTokenWrapper as GovernedTokenWrapperContract, GovernedTokenWrapper__factory } from '../../../typechain';

class GovernedTokenWrapper {
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

  public grantMinterRole(address: string) {
    const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
    return this.contract.grantRole(MINTER_ROLE, address);
  }

  public async createResourceId(): Promise<string> {
    return toHex(this.contract.address + toHex((await this.signer.getChainId()), 4).substr(2), 32);
  }

  public async getAddTokenProposalData(tokenAddress: string): Promise<string> {
    //First 4 bytes of keccak hash is encoded function sig...
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("add(address,uint256)")).slice(0, 10).padEnd(66, '0');
    const chainID = await this.signer.getChainId();
    const nonce = (await this.contract.storageNonce()).add(1).toNumber();
    console.log("token address", tokenAddress);
  
    return '0x' +
      toHex(chainID, 32).substr(2) + 
      toHex(nonce, 32).substr(2) +
      functionSig.slice(2) + 
      tokenAddress.padEnd(66, '0').slice(2);
  }

  public async getRemoveTokenProposalData(tokenAddress: string): Promise<string> {
    //First 4 bytes of keccak hash is encoded function sig...
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("remove(address,uint256)")).slice(0, 10).padEnd(66, '0');
    const chainID = await this.signer.getChainId();
    const nonce = (await this.contract.storageNonce()).add(1).toNumber();

    return '0x' +
      toHex(chainID, 32).substr(2) + 
      toHex(nonce, 32).substr(2) + 
      functionSig.slice(2) +
      tokenAddress.padEnd(66, '0').slice(2);
  }

  public async getFeeProposalData(fee: number): Promise<string> {
    //First 4 bytes of keccak hash is encoded function sig...
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("setFee(uint8,uint256)")).slice(0, 10).padEnd(66, '0');
    console.log(functionSig);
    const chainID = await this.signer.getChainId();
    console.log(chainID, "chainID");
    const nonce = (await this.contract.storageNonce()).add(1).toNumber();
    const feeString = toHex(fee, 1).padEnd(66, '0');

    return '0x' +
      toHex(chainID, 32).substr(2) + 
      toHex(nonce, 32).substr(2) + 
      functionSig.slice(2) +
      feeString.slice(2);
  }

}

export { GovernedTokenWrapper };
