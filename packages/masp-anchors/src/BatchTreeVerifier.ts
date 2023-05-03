import { ethers, Signer } from 'ethers';

import {
  BatchTreeVerifierSelector as BatchTreeVerifierSelectorContract,
  BatchTreeVerifierSelector__factory,
  VerifierBatch_4__factory as v4__factory,
  VerifierBatch_8__factory as v8__factory,
  VerifierBatch_16__factory as v16__factory,
  VerifierBatch_32__factory as v32__factory,
} from '@webb-tools/masp-anchor-contracts';
import { Deployer } from '@webb-tools/create2-utils';

export class BatchTreeVerifier {
  signer: ethers.Signer;
  contract: BatchTreeVerifierSelectorContract;

  public constructor(contract: BatchTreeVerifierSelectorContract, signer: ethers.Signer) {
    this.signer = signer;
    this.contract = contract;
  }
  public static async createVerifier(signer: Signer) {
    const v4Factory = new v4__factory(signer);
    const v4 = await v4Factory.deploy();
    await v4.deployed();

    const v8Factory = new v8__factory(signer);
    const v8 = await v8Factory.deploy();
    await v8.deployed();

    const v16Factory = new v16__factory(signer);
    const v16 = await v16Factory.deploy();
    await v16.deployed();

    const v32Factory = new v32__factory(signer);
    const v32 = await v32Factory.deploy();
    await v32.deployed();

    const factory = new BatchTreeVerifierSelector__factory(signer);
    const verifier = await factory.deploy(v4.address, v16.address, v8.address, v32.address);
    await verifier.deployed();
    return new BatchTreeVerifier(verifier, signer);
  }

  public static async create2Verifiers(
    deployer: Deployer,
    saltHex: string,
    v4__factory: any,
    v8__factory: any,
    v16__factory: any,
    v32__factory: any,
    signer: Signer
  ): Promise<{ v4: any; v8: any; v16: any; v32: any }> {
    const { contract: v4 } = await deployer.deploy(v4__factory, saltHex, signer);
    const { contract: v8 } = await deployer.deploy(v8__factory, saltHex, signer);
    const { contract: v16 } = await deployer.deploy(v16__factory, saltHex, signer);
    const { contract: v32 } = await deployer.deploy(v32__factory, saltHex, signer);

    return { v4, v8, v16, v32 };
  }

  public static async create2BatchTreeVerifier(
    deployer: Deployer,
    saltHex: string,
    verifier__factory: any,
    signer: Signer,
    v4: any,
    v8: any,
    v16: any,
    v32: any
  ): Promise<BatchTreeVerifierSelectorContract> {
    const argTypes = ['address', 'address', 'address', 'address'];
    const args = [v4.address, v8.address, v16.address, v32.address];

    const { contract: verifier } = await deployer.deploy(
      verifier__factory,
      saltHex,
      signer,
      undefined,
      argTypes,
      args
    );
    return verifier;
  }
}

export default BatchTreeVerifier;
