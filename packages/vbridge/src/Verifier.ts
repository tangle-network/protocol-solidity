import { ethers } from 'ethers';

import {
  VAnchorVerifier__factory,
  Verifier22__factory,
  Verifier82__factory,
  Verifier216__factory,
  Verifier816__factory,
  VAnchorVerifier as VerifierContract,
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
    let deployTx = v22Factory.getDeployTransaction().data;
    let gasEstimate = v22Factory.signer.estimateGas({ data: deployTx });
    const v22 = await v22Factory.deploy({ gasLimit: gasEstimate }); 
    await v22.deployed();

    const v82Factory = new Verifier82__factory(signer);
    deployTx = v82Factory.getDeployTransaction().data;
    gasEstimate = v82Factory.signer.estimateGas({ data: deployTx });
    const v82 = await v82Factory.deploy({ gasLimit: gasEstimate }); 
    await v82.deployed();

    const v216Factory = new Verifier216__factory(signer);
    deployTx = v216Factory.getDeployTransaction().data;
    gasEstimate = v216Factory.signer.estimateGas({ data: deployTx });
    const v216 = await v216Factory.deploy({ gasLimit: gasEstimate }); 
    await v216.deployed();

    const v816Factory = new Verifier816__factory(signer);
    deployTx = v816Factory.getDeployTransaction().data;
    gasEstimate = v816Factory.signer.estimateGas({ data: deployTx });
    const v816 = await v816Factory.deploy({ gasLimit: gasEstimate }); 
    await v816.deployed();

    const factory = new VAnchorVerifier__factory(signer);
    deployTx = factory.getDeployTransaction(
      v22.address,
      v216.address,
      v82.address,
      v816.address
    ).data;
    gasEstimate = factory.signer.estimateGas({ data: deployTx });
    const verifier = await factory.deploy(
      v22.address,
      v216.address,
      v82.address,
      v816.address,
      { gasLimit: gasEstimate }
    );
    await verifier.deployed();
    const createdVerifier = new Verifier(verifier, signer);
    return createdVerifier;
  }
}

export default Verifier;
