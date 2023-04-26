import { ZkComponents } from '@webb-tools/utils';
import { BigNumberish, ethers } from 'ethers';
import { VAnchorEncodeInputs__factory, ChainalysisVAnchor__factory } from '@webb-tools/contracts';
import VAnchor from '../VAnchor';
import { Deployer } from '../Deployer';

export class ChainalysisVAnchor extends VAnchor {
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
      ChainalysisVAnchor__factory,
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
    createdVAnchor.latestSyncedBlock = receipt!.blockNumber!;
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

    const address = await encodeLibrary.getAddress();
    const factory = new ChainalysisVAnchor__factory(
      { ['contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs']: address },
      signer
    );
    const vAnchor = await factory.deploy(verifier, levels, hasher, handler, token, maxEdges, {});
    await vAnchor.deployed();
    const createdVAnchor = new ChainalysisVAnchor(
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
}
