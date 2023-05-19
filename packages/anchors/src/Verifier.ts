import { ethers, Signer } from 'ethers';

import {
  VAnchorVerifier as VerifierContract,
  VAnchorVerifier__factory,
  Verifier2_2__factory,
  Verifier8_2__factory,
  Verifier2_16__factory,
  Verifier8_16__factory,
  VerifierF2_2__factory,
  VerifierF8_2__factory,
  VerifierF2_16__factory,
  VerifierF8_16__factory,
} from '@webb-tools/contracts';
import { Deployer } from '@webb-tools/create2-utils';

export class VerifierBase {
  signer: ethers.Signer;
  contract: VerifierContract;

  public constructor(contract: VerifierContract, signer: ethers.Signer) {
    this.signer = signer;
    this.contract = contract;
  }
  public static async createFactories(
    v22__factory: any,
    v82__factory: any,
    v216__factory: any,
    v816__factory: any,
    signer: Signer
  ): Promise<{ v22; v82; v216; v816 }> {
    const v22Factory = new v22__factory(signer);
    const v22 = await v22Factory.deploy();
    await v22.deployed();

    const v82Factory = new v82__factory(signer);
    const v82 = await v82Factory.deploy();
    await v82.deployed();

    const v216Factory = new v216__factory(signer);
    const v216 = await v216Factory.deploy();
    await v216.deployed();

    const v816Factory = new v816__factory(signer);
    const v816 = await v816Factory.deploy();
    await v816.deployed();
    return { v22, v82, v216, v816 };
  }

  public static async create2Verifiers(
    deployer: Deployer,
    saltHex: string,
    v22__factory: any,
    v82__factory: any,
    v216__factory: any,
    v816__factory: any,
    signer: Signer
  ): Promise<{ v22; v82; v216; v816 }> {
    const { contract: v22 } = await deployer.deploy(v22__factory, saltHex, signer);
    const { contract: v82 } = await deployer.deploy(v82__factory, saltHex, signer);
    const { contract: v216 } = await deployer.deploy(v216__factory, saltHex, signer);
    const { contract: v816 } = await deployer.deploy(v816__factory, saltHex, signer);

    return { v22, v82, v216, v816 };
  }
  public static async create2VAnchorVerifier(
    deployer: Deployer,
    saltHex: string,
    verifier__factory: any,
    signer: Signer,
    { v22, v82, v216, v816 }
  ): Promise<VerifierContract> {
    const argTypes = ['address', 'address', 'address', 'address'];
    const args = [v22.address, v216.address, v82.address, v816.address];

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
  public static async createVAnchorVerifier(
    vanchorVerifier__factory: any,
    signer: Signer,
    { v22, v82, v216, v816 }
  ) {
    const factory = new vanchorVerifier__factory(signer);
    const verifier = await factory.deploy(v22.address, v216.address, v82.address, v816.address);
    await verifier.deployed();
    return verifier;
  }
}

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
export class Verifier extends VerifierBase {
  signer: ethers.Signer;
  contract: VerifierContract;

  private constructor(contract: VerifierContract, signer: ethers.Signer) {
    super(contract, signer);
    this.signer = signer;
    this.contract = contract;
  }

  public static async create2Verifier(deployer: Deployer, salt: string, signer: ethers.Signer) {
    const saltHex = ethers.utils.id(salt);
    const verifiers = await this.create2Verifiers(
      deployer,
      saltHex,
      Verifier2_2__factory,
      Verifier8_2__factory,
      Verifier2_16__factory,
      Verifier8_16__factory,
      signer
    );

    const verifier = await this.create2VAnchorVerifier(
      deployer,
      saltHex,
      VAnchorVerifier__factory,
      signer,
      verifiers
    );
    const createdVerifier = new Verifier(verifier, signer);
    return createdVerifier;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(signer: ethers.Signer) {
    const verifiers = await this.createFactories(
      Verifier2_2__factory,
      Verifier8_2__factory,
      Verifier2_16__factory,
      Verifier8_16__factory,
      signer
    );

    const verifier = await this.createVAnchorVerifier(VAnchorVerifier__factory, signer, verifiers);
    const createdVerifier = new Verifier(verifier, signer);
    return createdVerifier;
  }
}

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
export class ForestVerifier extends VerifierBase {
  signer: ethers.Signer;
  contract: VerifierContract;

  private constructor(contract: VerifierContract, signer: ethers.Signer) {
    super(contract, signer);
    this.signer = signer;
    this.contract = contract;
  }

  public static async create2Verifier(deployer: Deployer, salt: string, signer: ethers.Signer) {
    const saltHex = ethers.utils.id(salt);
    const verifiers = await this.create2Verifiers(
      deployer,
      saltHex,
      VerifierF2_2__factory,
      VerifierF8_2__factory,
      VerifierF2_16__factory,
      VerifierF8_16__factory,
      signer
    );

    const verifier = await this.create2VAnchorVerifier(
      deployer,
      saltHex,
      VAnchorVerifier__factory,
      signer,
      verifiers
    );
    const createdVerifier = new ForestVerifier(verifier, signer);
    return createdVerifier;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(signer: ethers.Signer) {
    const verifiers = await this.createFactories(
      VerifierF2_2__factory,
      VerifierF8_2__factory,
      VerifierF2_16__factory,
      VerifierF8_16__factory,
      signer
    );

    const verifier = await this.createVAnchorVerifier(VAnchorVerifier__factory, signer, verifiers);
    const createdVerifier = new ForestVerifier(verifier, signer);
    return createdVerifier;
  }
}

export default Verifier;
