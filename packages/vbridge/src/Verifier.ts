import { ethers } from 'ethers';

import {
  VAnchorVerifier__factory,
  IdentityVAnchorVerifier__factory,
  Verifier22__factory,
  Verifier82__factory,
  Verifier216__factory,
  Verifier816__factory,
  VAnchorVerifier as VerifierContract,
  VerifierID22__factory,
  VerifierID82__factory,
  VerifierID216__factory,
  VerifierID816__factory,
} from '@webb-tools/contracts';

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
export class Verifier {
  signer: ethers.Signer;
  contract: VerifierContract;

  private constructor(contract: VerifierContract, signer: ethers.Signer) {
    this.signer = signer;
    this.contract = contract;
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
export default Verifier;
