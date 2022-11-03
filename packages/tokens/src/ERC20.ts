import {ethers} from "ethers";
import {ERC20 as ERC20Contract, ERC20__factory} from "@webb-tools/contracts";

class ERC20 {
  contract: ERC20Contract;

  constructor(contract: ERC20Contract) {
    this.contract = contract;
  }

  public static async createERC20(
    name: string,
    symbol: string,
    deployer: ethers.Signer
  ): Promise<ERC20> {
    const factory = new ERC20__factory(deployer);
    const contract = await factory.deploy(name, symbol);
    await contract.deployed();

    const handler = new ERC20(contract);
    return handler;
  }
}

export {ERC20};
