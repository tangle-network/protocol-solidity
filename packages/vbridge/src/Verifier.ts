import { ethers } from 'ethers';

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
// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
export class Verifier {
  signer: ethers.Signer;
  contract: VerifierContract;

  private constructor(contract: VerifierContract, signer: ethers.Signer) {
    this.signer = signer;
    this.contract = contract;
  }
  public static async create2Verifier(deployer: DeterministicDeployFactoryContract, salt: string, signer: ethers.Signer) {
    const saltHex = ethers.utils.id(salt)

    const v22Factory = new Verifier22__factory(signer);
    const v22Bytecode = v22Factory['bytecode']
    const v22InitCode = v22Bytecode + encoder([], [])
    const v22create2Addr = create2Address(deployer.address, saltHex, v22InitCode)
    const v22tx = await deployer.deploy(v22InitCode, saltHex);
    const v22receipt = await v22tx.wait()
    const v22 = await v22Factory.attach(v22receipt.events[0].args[0]);

    const v82Factory = new Verifier82__factory(signer);
    const v82Bytecode = v82Factory['bytecode']
    const v82InitCode = v22Bytecode + encoder([], [])
    const v82tx = await deployer.deploy(v82Bytecode, saltHex);
    const v82create2Addr = create2Address(deployer.address, saltHex, v82InitCode)
    const v82receipt = await v82tx.wait()
    const v82 = await v82Factory.attach(v82receipt.events[0].args[0]);

    const v216Factory = new Verifier216__factory(signer);
    const v216Bytecode = v216Factory['bytecode']
    const v216InitCode = v216Bytecode + encoder([], [])
    const v216create2Addr = create2Address(deployer.address, saltHex, v216InitCode)
    const v216tx = await deployer.deploy(v216Bytecode, saltHex);
    const v216receipt = await v216tx.wait()
    const v216 = await v216Factory.attach(v82receipt.events[0].args[0]);

    const v816Factory = new Verifier816__factory(signer);
    const v816Bytecode = v816Factory['bytecode']
    const v816InitCode = v816Bytecode + encoder([], [])
    const v816create2Addr = create2Address(deployer.address, saltHex, v816InitCode)
    const v816tx = await deployer.deploy(v816Bytecode, saltHex);
    const v816receipt = await v816tx.wait()
    const v816 = await v816Factory.attach(v816receipt.events[0].args[0]);

    const VerifierFactory = new VAnchorVerifier__factory(signer);
    const verifierBytecode = VerifierFactory['bytecode']
    const verifierInitCode = verifierBytecode + encoder(['address', 'address','address', 'address'], [v22.address, v216.address, v82.address, v816.address])

    const verifierTx = await deployer.deploy(verifierInitCode, saltHex);
    const verifierReceipt = await verifierTx.wait()
    // const verifier = await VerifierFactory.deploy(v22.address, v216.address, v82.address, v816.address);
    const verifier = await VerifierFactory.attach(verifierReceipt.events[0].args[0]);
    const createdVerifier = new Verifier(verifier, signer);
    return createdVerifier;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(signer: ethers.Signer) {
    const v22Factory = new Verifier22__factory(signer);
    const v22 = await v22Factory.deploy();
    await v22.deployed();

    const v82Factory = new Verifier82__factory(signer);
    const v82 = await v82Factory.deploy();
    await v82.deployed();

    const v216Factory = new Verifier216__factory(signer);
    const v216 = await v216Factory.deploy();
    await v216.deployed();

    const v816Factory = new Verifier816__factory(signer);
    const v816 = await v816Factory.deploy();
    await v816.deployed();

    const factory = new VAnchorVerifier__factory(signer);
    const verifier = await factory.deploy(v22.address, v216.address, v82.address, v816.address);
    await verifier.deployed();
    const createdVerifier = new Verifier(verifier, signer);
    return createdVerifier;
  }
}

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
export class IdentityVerifier {
  signer: ethers.Signer;
  contract: VerifierContract;

  private constructor(contract: VerifierContract, signer: ethers.Signer) {
    this.signer = signer;
    this.contract = contract;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(signer: ethers.Signer) {
    const v22Factory = new VerifierID22__factory(signer);
    const v22 = await v22Factory.deploy();
    await v22.deployed();

    const v82Factory = new VerifierID82__factory(signer);
    const v82 = await v82Factory.deploy();
    await v82.deployed();

    const v216Factory = new VerifierID216__factory(signer);
    const v216 = await v216Factory.deploy();
    await v216.deployed();

    const v816Factory = new VerifierID816__factory(signer);
    const v816 = await v816Factory.deploy();
    await v816.deployed();

    const factory = new IdentityVAnchorVerifier__factory(signer);
    const verifier = await factory.deploy(v22.address, v216.address, v82.address, v816.address);
    await verifier.deployed();
    const createdVerifier = new IdentityVerifier(verifier, signer);
    return createdVerifier;
  }
}
// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
export class ForestVerifier {
  signer: ethers.Signer;
  contract: VerifierContract;

  private constructor(contract: VerifierContract, signer: ethers.Signer) {
    this.signer = signer;
    this.contract = contract;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(signer: ethers.Signer) {
    const v22Factory = new VerifierF22__factory(signer);
    const v22 = await v22Factory.deploy();
    await v22.deployed();

    const v82Factory = new VerifierF82__factory(signer);
    const v82 = await v82Factory.deploy();
    await v82.deployed();

    const v216Factory = new VerifierF216__factory(signer);
    const v216 = await v216Factory.deploy();
    await v216.deployed();

    const v816Factory = new VerifierF816__factory(signer);
    const v816 = await v816Factory.deploy();
    await v816.deployed();

    const factory = new VAnchorVerifier__factory(signer);
    const verifier = await factory.deploy(v22.address, v216.address, v82.address, v816.address);
    await verifier.deployed();
    const createdVerifier = new ForestVerifier(verifier, signer);
    return createdVerifier;
  }
}
export default Verifier;
