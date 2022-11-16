import { ethers } from 'ethers';
import {
  ERC20PresetMinterPauser as ERC20PresetMinterPauserContract,
  ERC20PresetMinterPauser__factory
} from '@webb-tools/contracts';

class ERC20 {
  contract: ERC20PresetMinterPauserContract;

  constructor(contract: ERC20PresetMinterPauserContract) {
    this.contract = contract;
  }

  public static async createERC20PresetMinterPauser(
    name: string,
    symbol: string,
    deployer: ethers.Signer
  ): Promise<ERC20> {
    const factory = new ERC20PresetMinterPauser__factory(deployer);
    const contract = await factory.deploy(name, symbol);
    await contract.deployed();

    const handler = new ERC20(contract);
    return handler;
  }
}

export { ERC20 };
