import { ethers } from "ethers";
import { AnchorProxy as AnchorProxyContract} from '../../typechain/AnchorProxy';
import { AnchorProxy__factory } from "../../typechain/factories/AnchorProxy__factory";

enum InstanceStateEnum {
    ENABLED,
    DISABLED,
    MINEABLE,
  }

interface IInstance {
  token: string;
  state: InstanceStateEnum;
}

interface IAnchorStruct {
  addr: string;
  instance: IInstance;
}

class AnchorProxy {
  contract: AnchorProxyContract;
  
  constructor(
    contract: AnchorProxyContract
  ) {
    this.contract = contract;
  }

  public static async createAnchorProxy(
    _anchorTrees: string,
    _governance: string,
    _instances: IAnchorStruct[],
    deployer: ethers.Signer
  ) {
    const factory = new AnchorProxy__factory(deployer);
    const contract = await factory.deploy(_anchorTrees, _governance, _instances);
    await contract.deployed();

    const handler = new AnchorProxy(contract);
    return handler;
  }
}

export default AnchorProxy;
