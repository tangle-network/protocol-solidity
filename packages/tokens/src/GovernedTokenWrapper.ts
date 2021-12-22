import { ethers } from "ethers";
import { toFixedHex, toHex } from '@webb-tools/utils';
import { GovernedTokenWrapper as GovernedTokenWrapperContract, GovernedTokenWrapper__factory } from '@webb-tools/contracts';

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
    const functionSig = 0 // abi.encodeFunctionSignature("updateEdge(uint256,bytes32,uint256)");
    //console.log('functionSig', functionSig);
    const chainID = await this.signer.getChainId();
    const nonce = (await this.contract.storageNonce()).add(1).toNumber();

    return '0x' +
      toHex(functionSig, 32).substr(2) +
      toHex(chainID, 32).substr(2) + 
      toHex(nonce, 32).substr(2) + 
      toHex(tokenAddress, 32).substr(2);
  }

  public async getRemoveTokenProposalData(tokenAddress: string): Promise<string> {
    const functionSig = 0 // abi.encodeFunctionSignature("updateEdge(uint256,bytes32,uint256)");
    //console.log('functionSig', functionSig);
    const chainID = await this.signer.getChainId();
    const nonce = (await this.contract.storageNonce()).add(1).toNumber();

    return '0x' +
      toHex(functionSig, 32).substr(2) +
      toHex(chainID, 32).substr(2) + 
      toHex(nonce, 32).substr(2) + 
      toHex(tokenAddress, 32).substr(2);
  }

  public async getFeeProposalData(fee: number): Promise<string> {
    const functionSig = 0 // abi.encodeFunctionSignature("updateEdge(uint256,bytes32,uint256)");
    //console.log('functionSig', functionSig);
    const chainID = await this.signer.getChainId();
    const nonce = (await this.contract.storageNonce()).add(1).toNumber();

    return '0x' +
      toHex(functionSig, 32).substr(2) +
      toHex(chainID, 32).substr(2) + 
      toHex(nonce, 32).substr(2) + 
      toHex(fee, 32).substr(2);
  }

}

export { GovernedTokenWrapper };
