import { ethers } from "ethers";
import { Overrides } from "@webb-tools/utils";
import { GovernedTokenWrapper as GovernedTokenWrapperContract, GovernedTokenWrapper__factory } from '@webb-tools/contracts';

class GovernedTokenWrapper {
  contract: GovernedTokenWrapperContract;
  
  constructor(
    contract: GovernedTokenWrapperContract
  ) {
    this.contract = contract;
  }

  public static async createGovernedTokenWrapper(
    name: string,
    symbol: string,
    governor: string,
    limit: string,
    isNativeAllowed: boolean,
    deployer: ethers.Signer,
    overrides?: Overrides,
  ) {
    const factory = new GovernedTokenWrapper__factory(deployer);
    const contract = await factory.deploy(
      name,
      symbol,
      governor,
      limit,
      isNativeAllowed,
      overrides
    );
    await contract.deployed();

    const handler = new GovernedTokenWrapper(contract);
    return handler;
  }

  public static connect(address: string, signer: ethers.Signer) {
    const contract = GovernedTokenWrapper__factory.connect(address, signer);
    const tokenWrapper = new GovernedTokenWrapper(contract);
    return tokenWrapper;
  }

  public grantMinterRole(address: string, overrides?: Overrides) {
    const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
    return this.contract.grantRole(MINTER_ROLE, address, overrides);
  }
}

export { GovernedTokenWrapper };
