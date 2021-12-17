import { ethers } from "ethers";
import { SignatureGovernedTokenWrapper as SignatureGovernedTokenWrapperContract, SignatureGovernedTokenWrapper__factory } from '../../../typechain';
import { BigNumberish } from "ethers";
import { toFixedHex } from "@webb-tools/utils";

class SignatureGovernedTokenWrapper {
  contract: SignatureGovernedTokenWrapperContract;
  signingSystemSignFn: (data: any) => Promise<string>;

  constructor(
    contract: SignatureGovernedTokenWrapperContract,
    signer: ethers.Signer,
    signingSystemSignFn?: (data: any) => Promise<string>
  ) {
    this.contract = contract;
    if (signingSystemSignFn) {
        this.signingSystemSignFn = signingSystemSignFn;
    } else {
      this.signingSystemSignFn = (data: any) => {
        return signer.signMessage(data)
      };
    }
  }

  public static async createSignatureGovernedTokenWrapper(
    name: string,
    symbol: string,
    governor: string,
    limit: string,
    isNativeAllowed: boolean,
    deployer: ethers.Signer
  ) {
    const factory = new SignatureGovernedTokenWrapper__factory(deployer);
    const contract = await factory.deploy(
      name,
      symbol,
      governor,
      limit,
      isNativeAllowed
    );
    await contract.deployed();

    const handler = new SignatureGovernedTokenWrapper(contract, deployer);
    return handler;
  }

  public static connect(address: string, signer: ethers.Signer) {
    const contract = SignatureGovernedTokenWrapper__factory.connect(address, signer);
    const tokenWrapper = new SignatureGovernedTokenWrapper(contract, signer);
    return tokenWrapper;
  }

  public grantMinterRole(address: string) {
    const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
    return this.contract.grantRole(MINTER_ROLE, address);
  }

  public async addWithSignature(tokenAddress: string) {
    const unsignedData = tokenAddress;
    const unsignedMsg = ethers.utils.arrayify(unsignedData);
    const sig = await this.signingSystemSignFn(unsignedMsg);
    await this.contract.addWithSignature(tokenAddress, sig);
  }

  public async setFeeWithSignature(fee: BigNumberish) {
    const feeMsg = ethers.utils.arrayify(toFixedHex(fee));
    const sig = await this.signingSystemSignFn(feeMsg);
    await this.contract.setFeeWithSignature(feeMsg, sig);
  }
}

export { SignatureGovernedTokenWrapper };
