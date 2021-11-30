import { ethers, BigNumberish } from "ethers";
import { AnchorTrees as AnchorTreesContract, AnchorTrees__factory } from '@webb-tools/contracts';


export class AnchorTrees {
    signer: ethers.Signer;
    contract: AnchorTreesContract;

    constructor(
      signer: ethers.Signer,
      contract: AnchorTreesContract
    ) {
      this.signer = signer;
      this.contract = contract;
    }

    public static async createAnchorTrees (
      _governance: string,
      _anchorTreesV1: string,
      _searchParams: {
        depositsFrom: BigNumberish,
        depositsStep: BigNumberish,
        withdrawalsFrom: BigNumberish,
        withdrawalsStep: BigNumberish
      },
      _maxEdges: number,
      deployer: ethers.Signer
    ) {
      
      const factory = new AnchorTrees__factory(deployer);
      const contract = await factory.deploy(_governance, _anchorTreesV1, _searchParams, _maxEdges);
      await contract.deployed();

      return new AnchorTrees(deployer, contract);
    }

    public async initialize(
      anchorProxy: string,
      verifier: string,
    ) {
      const tx = await this.contract.initialize(anchorProxy, verifier);
      await tx.wait();
    }

    public async updateDepositTree() {
      const tx = await this.contract.updateDepositTree(); //TODO
      tx.wait();
    }

    public async updateWithdrawalTree() {
      const tx = await this.contract.updateWithdrawalTree(); //TODO
      tx.wait();
    }
}

