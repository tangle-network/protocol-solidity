import { ZkComponents } from '@webb-tools/utils';
import { BigNumberish, ethers, BigNumber } from 'ethers';
import { VAnchorEncodeInputs__factory, ChainalysisVAnchor__factory } from '@webb-tools/contracts';
import VAnchor from './VAnchor';
import { Deployer } from './Deployer';

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
    const { contract: libraryContract } = await deployer.deploy(VAnchorEncodeInputs__factory, saltHex, signer);

    let libraryAddresses = {
      ['contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs']: libraryContract.address
    };

    const argTypes = ["address", "uint32", "address", "address", "address", "uint8"];
    const args = [verifier, levels, hasher, handler, token, maxEdges];
    const { contract: vanchor, receipt } = await deployer.deploy(ChainalysisVAnchor__factory, saltHex, signer, libraryAddresses, argTypes, args);
    const createdVAnchor = new VAnchor(
      vanchor,
      signer,
      BigNumber.from(levels).toNumber(),
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    console.log('vanchor', vanchor.deployTransaction);
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
    const factory = new ChainalysisVAnchor__factory(
      { ['contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs']: encodeLibrary.address },
      signer
    );
    const vAnchor = await factory.deploy(verifier, levels, hasher, handler, token, maxEdges, {});
    await vAnchor.deployed();
    const createdVAnchor = new ChainalysisVAnchor(
      vAnchor,
      signer,
      BigNumber.from(levels).toNumber(),
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdVAnchor.latestSyncedBlock = vAnchor.deployTransaction.blockNumber!;
    createdVAnchor.token = token;
    return createdVAnchor;
  }
}
