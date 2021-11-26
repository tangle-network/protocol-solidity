import { ethers } from "ethers";
import { VAnchorVerifier__factory } from '../../typechain/factories/VAnchorVerifier__factory';
import { Verifier22__factory } from '../../typechain/factories/Verifier22__factory';
import { Verifier82__factory } from '../../typechain/factories/Verifier82__factory';
import { Verifier216__factory } from '../../typechain/factories/Verifier216__factory';
import { Verifier816__factory } from '../../typechain/factories/Verifier816__factory';
import { VAnchorVerifier as VerifierContract} from '../../typechain/VAnchorVerifier';

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
class Verifier {
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
  ) {
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
    const verifier = await factory.deploy(
      v22.address,
      v216.address,
      v82.address,
      v816.address,
    );
    await verifier.deployed();
    const createdVerifier = new Verifier(verifier, signer);
    return createdVerifier;
  }
}

export default Verifier;
