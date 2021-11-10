import { ethers } from "ethers";
import { ERC20 as ERC20Contract} from '../../typechain/ERC20';
import { ERC20__factory } from "../../typechain/factories/ERC20__factory";

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
    deployer: ethers.Signer
  ): Promise<ERC20> {
    const factory = new ERC20__factory(deployer);
    const contract = await factory.deploy(
      name,
      symbol,
    );
    await contract.deployed();

    const handler = new ERC20(contract);
    return handler;
  }
}

export default ERC20;
