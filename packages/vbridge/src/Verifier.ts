import { ethers, Signer } from 'ethers';

import {
  VAnchorVerifier__factory,
  IdentityVAnchorVerifier__factory,
  Verifier22__factory,
  Verifier82__factory,
  Verifier216__factory,
  Verifier816__factory,
  VAnchorVerifier as VerifierContract,
  DeterministicDeployFactory as DeterministicDeployFactoryContract,
  VerifierID22__factory,
  VerifierID82__factory,
  VerifierID216__factory,
  VerifierID816__factory,
  VerifierF22__factory,
  VerifierF82__factory,
  VerifierF216__factory,
  VerifierF816__factory,
} from '@webb-tools/contracts';

const encoder = (types, values) => {
  const abiCoder = ethers.utils.defaultAbiCoder;
  const encodedParams = abiCoder.encode(types, values);
  return encodedParams.slice(2);
};

const create2Address = (factoryAddress, saltHex, initCode) => {
  const create2Addr = ethers.utils.getCreate2Address(factoryAddress, saltHex, ethers.utils.keccak256(initCode));
  return create2Addr;
}

// type V22Factory = Verifier22__factory | VerifierID22__factory | VerifierF22__factory
// type V82Factory = Verifier82__factory | VerifierID82__factory | VerifierF82__factory
// type V216Factory = Verifier216__factory | VerifierID216__factory | VerifierF216__factory
// type V816Factory = Verifier816__factory | VerifierID816__factory | VerifierF816__factory

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
  ) {
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

  public static async create2Factories(deployer, saltHex, v22__factory, v82__factory, v216__factory, v816__factory, signer: Signer) {
    const v22 = await this.create2SingleVerifier(deployer, saltHex, v22__factory, signer);
    const v82 = await this.create2SingleVerifier(deployer, saltHex, v82__factory, signer);
    const v216 = await this.create2SingleVerifier(deployer, saltHex, v216__factory, signer);
    const v816 = await this.create2SingleVerifier(deployer, saltHex, v816__factory, signer);

    return { v22, v82, v216, v816 };
  }
  public static async create2SingleVerifier(
    deployer,
    saltHex,
    verifier__factory,
    signer: Signer
  ) {
    const verifierFactory = new verifier__factory(signer);
    const verifierBytecode = verifierFactory['bytecode']
    const verifierInitCode = verifierBytecode + encoder([], [])
    const verifierCreate2Addr = create2Address(deployer.address, saltHex, verifierInitCode)
    const verifierTx = await deployer.deploy(verifierInitCode, saltHex);
    const verifierReceipt = await verifierTx.wait()
    if (verifierReceipt.events[0].args[0] !== verifierCreate2Addr) {
      throw new Error('create2 address mismatch')
    }
    const contract = await verifierFactory.attach(verifierReceipt.events[0].args[0]);
    return contract
  }
}

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
export class Verifier extends VerifierBase {
  signer: ethers.Signer;
  contract: VerifierContract;

  private constructor(contract: VerifierContract, signer: ethers.Signer) {
    super(contract, signer)
    this.signer = signer;
    this.contract = contract;
  }
  public static async create2Verifier(deployer: DeterministicDeployFactoryContract, salt: string, signer: ethers.Signer) {
    const saltHex = ethers.utils.id(salt)
    const { v22, v82, v216, v816 } = await this.create2Factories(deployer, saltHex, Verifier22__factory, Verifier82__factory, Verifier216__factory, Verifier816__factory, signer);

    const VerifierFactory = new VAnchorVerifier__factory(signer);
    const verifierBytecode = VerifierFactory['bytecode']
    const verifierInitCode = verifierBytecode + encoder(['address', 'address', 'address', 'address'], [v22.address, v216.address, v82.address, v816.address])

    const verifierTx = await deployer.deploy(verifierInitCode, saltHex);
    const verifierReceipt = await verifierTx.wait()
    // const verifier = await VerifierFactory.deploy(v22.address, v216.address, v82.address, v816.address);
    const verifier = await VerifierFactory.attach(verifierReceipt.events[0].args[0]);
    const createdVerifier = new Verifier(verifier, signer);
    return createdVerifier;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(signer: ethers.Signer) {
    const { v22, v82, v216, v816 } = await this.createFactories(Verifier22__factory, Verifier82__factory, Verifier216__factory, Verifier816__factory, signer);

    const factory = new VAnchorVerifier__factory(signer);
    const verifier = await factory.deploy(v22.address, v216.address, v82.address, v816.address);
    await verifier.deployed();
    const createdVerifier = new Verifier(verifier, signer);
    return createdVerifier;
  }
}

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
export class IdentityVerifier extends VerifierBase {
  signer: ethers.Signer;
  contract: VerifierContract;

  private constructor(contract: VerifierContract, signer: ethers.Signer) {
    super(contract, signer)
    this.signer = signer;
    this.contract = contract;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(signer: ethers.Signer) {
    const { v22, v82, v216, v816 } = await this.createFactories(VerifierID22__factory, VerifierID82__factory, VerifierID216__factory, VerifierID816__factory, signer);

    const factory = new IdentityVAnchorVerifier__factory(signer);
    const verifier = await factory.deploy(v22.address, v216.address, v82.address, v816.address);
    await verifier.deployed();
    const createdVerifier = new IdentityVerifier(verifier, signer);
    return createdVerifier;
  }
}
// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
export class ForestVerifier extends VerifierBase {
  signer: ethers.Signer;
  contract: VerifierContract;

  private constructor(contract: VerifierContract, signer: ethers.Signer) {
    super(contract, signer)
    this.signer = signer;
    this.contract = contract;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(signer: ethers.Signer) {
    const { v22, v82, v216, v816 } = await this.createFactories(VerifierF22__factory, VerifierF82__factory, VerifierF216__factory, VerifierF816__factory, signer);

    const factory = new VAnchorVerifier__factory(signer);
    const verifier = await factory.deploy(v22.address, v216.address, v82.address, v816.address);
    await verifier.deployed();
    const createdVerifier = new ForestVerifier(verifier, signer);
    return createdVerifier;
  }
}
export default Verifier;
