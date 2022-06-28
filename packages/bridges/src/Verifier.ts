import { ethers } from "ethers";
import {
  Verifier as VerifierContract,
  Verifier__factory,
  Verifier2__factory,
  Verifier3__factory,
  Verifier4__factory,
  Verifier5__factory,
  Verifier6__factory,
} from '@webb-tools/contracts';

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
  ) {
    const v2Factory = new Verifier2__factory(signer);
    let deployTx = v2Factory.getDeployTransaction().data;
    let gasEstimate = await v2Factory.signer.estimateGas({ data: deployTx });
    const v2 = await v2Factory.deploy({ gasLimit: gasEstimate }); 
    await v2.deployed();
    const v3Factory = new Verifier3__factory(signer);
    deployTx = v3Factory.getDeployTransaction().data;
    gasEstimate = await v3Factory.signer.estimateGas({ data: deployTx });
    const v3 = await v3Factory.deploy({ gasLimit: gasEstimate }); 
    await v3.deployed();
    const v4Factory = new Verifier4__factory(signer);
    deployTx = v4Factory.getDeployTransaction().data;
    gasEstimate = await v4Factory.signer.estimateGas({ data: deployTx });
    const v4 = await v4Factory.deploy({ gasLimit: gasEstimate });
    await v4.deployed();
    const v5Factory = new Verifier5__factory(signer);
    deployTx = v5Factory.getDeployTransaction().data;
    gasEstimate = await v5Factory.signer.estimateGas({ data: deployTx });
    const v5 = await v5Factory.deploy({ gasLimit: gasEstimate });
    await v5.deployed();
    const v6Factory = new Verifier6__factory(signer);
    deployTx = v6Factory.getDeployTransaction().data;
    gasEstimate = await v6Factory.signer.estimateGas({ data: deployTx });
    const v6 = await v6Factory.deploy({ gasLimit: gasEstimate });
    await v6.deployed();

    const factory = new Verifier__factory(signer);
    deployTx = factory.getDeployTransaction(
      v2.address,
      v3.address,
      v4.address,
      v5.address,
      v6.address
    ).data;
    gasEstimate = await factory.signer.estimateGas({ data: deployTx });
    const verifier = await factory.deploy(
      v2.address,
      v3.address,
      v4.address,
      v5.address,
      v6.address,
      { gasLimit: gasEstimate }
    );
    await verifier.deployed();
    const createdVerifier = new Verifier(verifier, signer);
    return createdVerifier;
  }
}
