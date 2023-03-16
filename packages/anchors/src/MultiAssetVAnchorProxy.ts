import { BigNumber, ethers } from 'ethers';
import { MultiAssetVAnchorProxy as MultiAssetVAnchorProxyContract, MultiAssetVAnchorProxy__factory } from '@webb-tools/contracts';

import { MultiAssetVAnchor as MultiAssetVAnchorContract, MultiAssetVAnchor__factory } from '@webb-tools/contracts';

import { QueueDepositInfo } from '@webb-tools/interfaces';

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
  public async queueERC20Deposit(depositInfo: QueueDepositInfo) {
    await this.contract.queueERC20Deposit(
      depositInfo
    );
  }

  // Queue ERC721 deposits
  public async queueERC721Deposit(depositInfo: QueueDepositInfo) {
    await this.contract.queueERC721Deposit(
      depositInfo
    );
  }

  // Queue reward unspent tree commitments
  public async queueRewardUnspentCommitment(masp: string, commitment: string) {
    await this.contract.queueRewardUnspentTreeCommitment(
      masp,
      commitment
    );
  }

  // Queue reward spent tree commitments
  public async queueRewardSpentCommitment(commitment: string) {
    await this.contract.queueRewardSpentTreeCommitment(
      commitment,
    );
  }

  // Batch insert ERC20 deposits
  public async batchDepositERC20s(		
    masp: string,
		proof: string,
		argsHash: string,
		currentRoot: string,
		newRoot: string,
		pathIndices: BigNumber,
		batchHeight: BigNumber,
  ) {
    await this.contract.batchDepositERC20s(
      masp,
      proof,
      argsHash,
      currentRoot,
      newRoot,
      pathIndices,
      batchHeight,
    );
  }

  // Batch insert ERC721 deposits
  public async batchDepositERC721s(		
    masp: string,
    proof: string,
    argsHash: string,
    currentRoot: string,
    newRoot: string,
    pathIndices: BigNumber,
    batchHeight: BigNumber,
  ) {
    await this.contract.batchDepositERC20s(
      masp,
      proof,
      argsHash,
      currentRoot,
      newRoot,
      pathIndices,
      batchHeight,
    );
  }

  // Batch insert reward unspent tree commitments
  public async batchInsertRewardUnspentTree(		
    masp: string,
    proof: string,
    argsHash: string,
    currentRoot: string,
    newRoot: string,
    pathIndices: BigNumber,
    batchHeight: BigNumber,
  ) {
    await this.contract.batchInsertRewardUnspentTree(
      masp,
      proof,
      argsHash,
      currentRoot,
      newRoot,
      pathIndices,
      batchHeight,
    );
  }

  // Batch insert reward spent tree commitments
  public async batchInsertRewardSpentTree(		
    masp: string,
    proof: string,
    argsHash: string,
    currentRoot: string,
    newRoot: string,
    pathIndices: BigNumber,
    batchHeight: BigNumber,
  ) {
    await this.contract.batchInsertRewardUnspentTree(
      masp,
      proof,
      argsHash,
      currentRoot,
      newRoot,
      pathIndices,
      batchHeight,
    );
  }

  // Utility Classes *****

  // Get queued ERC20 deposits
}

