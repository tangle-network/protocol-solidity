import { ethers, Signer, ContractFactory } from 'ethers';

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
  ): Promise<{ v22, v82, v216, v816 }> {
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
    deployer: DeterministicDeployFactoryContract,
    saltHex: string,
    v22__factory: any,
    v82__factory: any,
    v216__factory: any,
    v816__factory: any,
    signer: Signer
  ): Promise<{ v22, v82, v216, v816 }> {
    const v22 = await this.create2SingleVerifier(deployer, saltHex, v22__factory, signer);
    const v82 = await this.create2SingleVerifier(deployer, saltHex, v82__factory, signer);
    const v216 = await this.create2SingleVerifier(deployer, saltHex, v216__factory, signer);
    const v816 = await this.create2SingleVerifier(deployer, saltHex, v816__factory, signer);

    return { v22, v82, v216, v816 };
  }
  public static async create2SingleVerifier(
    deployer: DeterministicDeployFactoryContract,
    saltHex: string,
    verifier__factory: any,
    signer: Signer
  ): Promise<any> {
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
  public static async create2VAnchorVerifier(
    deployer: DeterministicDeployFactoryContract,
    saltHex: string,
    verifier__factory: any,
    signer: Signer,
    { v22, v82, v216, v816 },
  ): Promise<VerifierContract> {
    const VAnchorVerifierFactory = new verifier__factory(signer);
    const vanchorVerifierBytecode = VAnchorVerifierFactory['bytecode']
    const vanchorVerifierInitCode = vanchorVerifierBytecode + encoder(['address', 'address', 'address', 'address'], [v22.address, v216.address, v82.address, v816.address])

    const vanchorVerifierTx = await deployer.deploy(vanchorVerifierInitCode, saltHex);
    const vanchorVerifierReceipt = await vanchorVerifierTx.wait()
    // const verifier = await VerifierFactory.deploy(v22.address, v216.address, v82.address, v816.address);
    const numEvents = vanchorVerifierReceipt.events.length
    const verifier = await VAnchorVerifierFactory.attach(vanchorVerifierReceipt.events[numEvents - 1].args[0]);
    return verifier;
  }
  public static async createVAnchorVerifier(
    vanchorVerifier__factory: any,
    signer: Signer,
    { v22, v82, v216, v816 },
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
    super(contract, signer)
    this.signer = signer;
    this.contract = contract;
  }
  public static async create2Verifier(
    deployer: DeterministicDeployFactoryContract,
    salt: string,
    signer: ethers.Signer
  ) {
    const saltHex = ethers.utils.id(salt)
    console.log('typeof saltHex: ', typeof saltHex)
    const verifiers = await this.create2Verifiers(
      deployer,
      saltHex,
      Verifier22__factory,
      Verifier82__factory,
      Verifier216__factory,
      Verifier816__factory,
      signer
    );

    const verifier = await this.create2VAnchorVerifier(
      deployer,
      saltHex,
      VAnchorVerifier__factory,
      signer,
      verifiers,
    );
    const createdVerifier = new Verifier(verifier, signer);
    return createdVerifier;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(signer: ethers.Signer) {
    const verifiers = await this.createFactories(
      Verifier22__factory,
      Verifier82__factory,
      Verifier216__factory,
      Verifier816__factory,
      signer
    );

    const verifier = await this.createVAnchorVerifier(
      VAnchorVerifier__factory,
      signer,
      verifiers
    )
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
  public static async create2Verifier(
    deployer: DeterministicDeployFactoryContract,
    salt: string,
    signer: ethers.Signer
  ) {
    const saltHex = ethers.utils.id(salt)
    const verifiers = await this.create2Verifiers(
      deployer,
      saltHex,
      VerifierID22__factory,
      VerifierID82__factory,
      VerifierID216__factory,
      VerifierID816__factory,
      signer
    );

    const verifier = await this.create2VAnchorVerifier(
      deployer,
      saltHex,
      IdentityVAnchorVerifier__factory,
      signer,
      verifiers
    )
    const createdVerifier = new IdentityVerifier(verifier, signer);
    return createdVerifier;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(signer: ethers.Signer) {
    const verifiers = await this.createFactories(
      VerifierID22__factory,
      VerifierID82__factory,
      VerifierID216__factory,
      VerifierID816__factory,
      signer
    );

    const verifier = await this.createVAnchorVerifier(
      IdentityVAnchorVerifier__factory,
      signer,
      verifiers
    )
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

  public static async create2Verifier(
    deployer: DeterministicDeployFactoryContract,
    salt: string,
    signer: ethers.Signer
  ) {
    const saltHex = ethers.utils.id(salt)
    const verifiers = await this.create2Verifiers(
      deployer,
      saltHex,
      VerifierF22__factory,
      VerifierF82__factory,
      VerifierF216__factory,
      VerifierF816__factory,
      signer
    );

    const verifier = await this.create2VAnchorVerifier(
      deployer,
      saltHex,
      IdentityVAnchorVerifier__factory,
      signer,
      verifiers
    )
    const createdVerifier = new ForestVerifier(verifier, signer);
    return createdVerifier;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(signer: ethers.Signer) {
    const verifiers = await this.createFactories(
      VerifierF22__factory,
      VerifierF82__factory,
      VerifierF216__factory,
      VerifierF816__factory,
      signer
    );

    const verifier = await this.createVAnchorVerifier(
      VAnchorVerifier__factory,
      signer,
      verifiers
    )
    const createdVerifier = new ForestVerifier(verifier, signer);
    return createdVerifier;
  }
}
export default Verifier;
