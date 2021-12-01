import { ethers } from "ethers";
import { ERC20 as ERC20Contract, ERC20__factory } from '@webb-tools/contracts';
import { Overrides } from "@webb-tools/utils";

class ERC20 {
  contract: ERC20Contract;
  
  constructor(
    contract: ERC20Contract
  ) {
    this.contract = contract;
  }

  public static async createERC20(
    name: string,
    symbol: string,
    deployer: ethers.Signer,
    overrides?: Overrides
  ): Promise<ERC20> {
    const factory = new ERC20__factory(deployer);
    const contract = await factory.deploy(
      name,
      symbol,
      overrides || {},
    );
    await contract.deployed();

    const handler = new ERC20(contract);
    return handler;
  }
}

export { ERC20 };
