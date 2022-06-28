import { ethers, Overrides } from 'ethers';

import {
  VAnchorVerifier__factory,
  Verifier22__factory,
  Verifier82__factory,
  Verifier216__factory,
  Verifier816__factory,
  VAnchorVerifier as VerifierContract
} from '@webb-tools/contracts'

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
export class Verifier {
  signer: ethers.Signer;
  contract: VerifierContract;

  private constructor(
    contract: VerifierContract,
    signer: ethers.Signer,
  ) {
    this.signer = signer;
    this.contract = contract;
  }

  // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
  public static async createVerifier(
    signer: ethers.Signer,
    overrides?: Overrides
  ) {
    const v22Factory = new Verifier22__factory(signer);
    const v22 = await v22Factory.deploy(overrides || {}); 
    await v22.deployed();

    const v82Factory = new Verifier82__factory(signer);
    const v82 = await v82Factory.deploy(overrides || {}); 
    await v82.deployed();

    const v216Factory = new Verifier216__factory(signer);
    const v216 = await v216Factory.deploy(overrides || {}); 
    await v216.deployed();

    const v816Factory = new Verifier816__factory(signer);
    const v816 = await v816Factory.deploy(overrides || {}); 
    await v816.deployed();

    const factory = new VAnchorVerifier__factory(signer);
    const verifier = await factory.deploy(
      v22.address,
      v216.address,
      v82.address,
      v816.address,
      overrides || {}
    );
    await verifier.deployed();
    const createdVerifier = new Verifier(verifier, signer);
    return createdVerifier;
  }
}

export default Verifier;
