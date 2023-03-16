import { ethers } from 'ethers';
import { MultiAssetVAnchorProxy as MultiAssetVAnchorProxyContract, MultiAssetVAnchorProxy__factory } from '@webb-tools/contracts';

import { MultiAssetVAnchor as MultiAssetVAnchorContract, MultiAssetVAnchor__factory } from '@webb-tools/contracts';

export class MultiAssetVAnchorProxy {
  contract: MultiAssetVAnchorProxyContract;

  // Constructor
  constructor(contract: MultiAssetVAnchorProxyContract) {
    this.contract = contract;
  }

  // Deploy a new MultiAssetVAnchorProxy
  public static async createMultiAssetVAnchorProxy(
    hasher: string,
    deployer: ethers.Signer
  ) {
    const factory = new MultiAssetVAnchorProxy__factory(deployer);
    const contract = await factory.deploy(hasher);
    await contract.deployed();

    const proxy = new MultiAssetVAnchorProxy(contract);
    return proxy;
  }

  // Initialize proxy with the addresses of a MultiAssetVAnchor contracts
  public async initialize(validMASPs: MultiAssetVAnchorContract[]) {
    await this.contract.initialize(validMASPs.map((m) => m.address));
  }

  // Queue ERC20 deposits

  // Queue ERC721 deposits

  // Queue reward unspent tree commitments

  // Queue reward spent tree commitments

  // Batch insert ERC20 deposits

  // Batch insert ERC721 deposits

  // Batch insert reward unspent tree commitments

  // Batch insert reward spent tree commitments
}

