import { ethers } from "ethers";
import { GovernedTokenWrapper as GovernedTokenWrapperContract} from '../../typechain/GovernedTokenWrapper';
import { GovernedTokenWrapper__factory } from "../../typechain/factories/GovernedTokenWrapper__factory";

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

    const handler = new GovernedTokenWrapper(contract);
    return handler;
  }
}

export default GovernedTokenWrapper;
