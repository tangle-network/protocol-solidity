import { ethers } from "ethers";

class Bridge {
  constructor(
    public contract: ethers.Contract,
    public provider: ethers.providers.Provider,
    public signer: ethers.Signer,
  ) {}

  public createUpdateProposal() {
    
  }
}

export default Bridge;
