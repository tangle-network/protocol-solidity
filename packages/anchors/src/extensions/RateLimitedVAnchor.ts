import { ZkComponents } from '@webb-tools/utils';
import { BigNumberish, ethers } from 'ethers';
import {
  VAnchorEncodeInputs__factory,
  RateLimitedVAnchor__factory,
  RateLimitedVAnchor as RateLimitedVAnchorContract,
} from '@webb-tools/contracts';
import VAnchor from '../VAnchor';
import { Deployer } from '../Deployer';

export class RateLimitedVAnchor extends VAnchor {
  public static async create2VAnchor(
    deployer: Deployer,
    saltHex: string,
    verifier: string,
    levels: BigNumberish,
    hasher: string,
    handler: string,
    token: string,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const { contract: libraryContract } = await deployer.deploy(
      VAnchorEncodeInputs__factory,
      saltHex,
      signer
    );

    let libraryAddresses = {
      ['contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs']: libraryContract.address,
    };

    const argTypes = ['address', 'uint32', 'address', 'address', 'address', 'uint8'];
    const args = [verifier, levels, hasher, handler, token, maxEdges];
    const { contract: vanchor, receipt } = await deployer.deploy(
      RateLimitedVAnchor__factory,
      saltHex,
      signer,
      libraryAddresses,
      argTypes,
      args
    );

    const createdVAnchor = new VAnchor(
      vanchor,
      signer,
      Number(levels),
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdVAnchor.latestSyncedBlock = receipt.blockNumber!;
    createdVAnchor.token = token;
    return createdVAnchor;
  }

  public static async createVAnchor(
    verifier: string,
    levels: BigNumberish,
    hasher: string,
    handler: string,
    token: string,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const encodeLibraryFactory = new VAnchorEncodeInputs__factory(signer);
    const encodeLibrary = await encodeLibraryFactory.deploy();
    await encodeLibrary.deployed();
    const factory = new RateLimitedVAnchor__factory(
      { ['contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs']: encodeLibrary.address },
      signer
    );
    const vAnchor = await factory.deploy(verifier, levels, hasher, handler, token, maxEdges, {});
    await vAnchor.deployed();
    const createdVAnchor = new RateLimitedVAnchor(
      vAnchor,
      signer,
      Number(levels),
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdVAnchor.latestSyncedBlock = vAnchor.deployTransaction.blockNumber!;
    createdVAnchor.token = token;
    const tx = await createdVAnchor.contract.initialize(
      BigInt('1'),
      BigInt(2) ^ (BigInt(256) - BigInt(1))
    );
    await tx.wait();
    return createdVAnchor;
  }

  public async setDailyWithdrawalLimit(limit: BigNumberish) {
    const nonce: BigNumberish = await this.contract.getProposalNonce();
    const tx = await (this.contract as RateLimitedVAnchorContract).setDailyWithdrawalLimit(
      limit,
      BigInt(nonce) + BigInt('1')
    );
    const result = await tx.wait();
    return result;
  }
}
