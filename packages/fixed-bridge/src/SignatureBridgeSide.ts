import { BigNumberish, ethers } from "ethers";
import { SignatureBridge, SignatureBridge__factory } from '../../../typechain';
import { Anchor } from './Anchor';
import { AnchorHandler } from "./AnchorHandler";
import { toFixedHex } from "@webb-tools/utils";
import { GovernedTokenWrapper } from "@webb-tools/tokens";

export type Proposal = {
  data: string,
  dataHash: string,
  resourceId: string,
  chainId: number,
  leafIndex: number,
}

export class SignatureBridgeSide {
  contract: SignatureBridge;
  admin: ethers.Signer;
  handler: AnchorHandler;
  proposals: Proposal[];
  signingSystemSignFn: (data: any) => Promise<string>;

  private constructor(
    contract: SignatureBridge,
    signer: ethers.Signer,
    signingSystemSignFn?: (data: any) => Promise<string>,
  ) {
    this.contract = contract;
    this.admin = signer;
    this.handler = null;
    this.proposals = [];
    if (signingSystemSignFn) {
      this.signingSystemSignFn = signingSystemSignFn;
    } else {
      this.signingSystemSignFn = (data: any) => {
        return signer.signMessage(data)
      };
    }
  }

  public static async createBridgeSide(
    initialGovernor: string,
    fee: ethers.BigNumberish,
    expiry: ethers.BigNumberish,
    admin: ethers.Signer
  ): Promise<SignatureBridgeSide> {
    const bridgeFactory = new SignatureBridge__factory(admin);
    const chainId = await admin.getChainId();
    const deployedBridge = await bridgeFactory.deploy(chainId, initialGovernor, fee, expiry);
    await deployedBridge.deployed();
    const bridgeSide = new SignatureBridgeSide(deployedBridge, admin);
    return bridgeSide;
  }

  public static async connect(address: string, admin: ethers.Signer) {
    const deployedBridge = SignatureBridge__factory.connect(address, admin);
    const bridgeSide = new SignatureBridgeSide(deployedBridge, admin);
    return bridgeSide;
  }

  /** Update proposals are created so that changes to an anchor's root chain Y can
  *** make its way to the neighbor root of the linked anchor on chain X.
  *** @param linkedAnchorInstance: the anchor instance on the opposite chain
  ***/
  public async createAnchorUpdateProposalData(linkedAnchorInstance: Anchor) {
    const proposalData = await linkedAnchorInstance.getProposalData();
    return proposalData;
  }

  public async createAddTokenUpdateProposalData(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    const proposalData = await governedToken.getAddTokenProposalData(tokenAddress);
    return proposalData;
  }

  public async setAnchorHandler(handler: AnchorHandler) {
    this.handler = handler;
  }

  // Connects the bridgeSide, anchor handler, and anchor.
  // Returns the resourceID used to connect them all
  public async connectAnchorWithSignature(anchor: Anchor): Promise<string> {
    const resourceId = await this.setResourceWithSignature(anchor);
    await anchor.setHandler(this.handler.contract.address);
    await anchor.setBridge(this.contract.address);

    return resourceId;
  }

  public async setResourceWithSignature(anchor: Anchor): Promise<string> {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }
    const resourceId = await anchor.createResourceId();

    const unsignedData = this.handler.contract.address + resourceId.slice(2) + anchor.contract.address.slice(2);
    const unsignedMsg = ethers.utils.arrayify(unsignedData);
    const sig = await this.signingSystemSignFn(unsignedMsg);
    await this.contract.adminSetResourceWithSignature(this.handler.contract.address, resourceId, anchor.contract.address, sig);
    return resourceId;
  }

  // public async changeFeeWithSignature(fee: BigNumberish): Promise<void> {
  //   const feeMsg = ethers.utils.arrayify(toFixedHex(fee));
  //   const sig = await this.signingSystemSignFn(feeMsg);
  //   await this.contract.adminChangeFeeWithSignature(feeMsg, sig);
  //   return;
  // }

  // emit ProposalEvent(chainID, nonce, ProposalStatus.Executed, dataHash);
  public async executeAnchorProposalWithSig(linkedAnchor: Anchor, thisAnchor: Anchor) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createAnchorUpdateProposalData(linkedAnchor);
    const resourceId = await thisAnchor.createResourceId();
    const chainId = await linkedAnchor.signer.getChainId();
    const nonce = linkedAnchor.tree.number_of_elements() - 1;
    const proposalMsg = ethers.utils.arrayify(proposalData);
    const sig = await this.signingSystemSignFn(proposalMsg);
    const tx = await this.contract.executeProposalWithSignature(chainId, nonce, proposalData, resourceId, sig);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async executeAddTokenProposalWithSig(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    if (!this.handler) {
      throw new Error("Cannot connect add token without a handler");
    }

    const proposalData = await this.createAddTokenUpdateProposalData(governedToken, tokenAddress);
    const resourceId = await governedToken.createResourceId();
    const chainId = await governedToken.signer.getChainId();
    const nonce = 0;
    const proposalMsg = ethers.utils.arrayify(proposalData);
    const sig = await this.signingSystemSignFn(proposalMsg);
    const tx = await this.contract.executeProposalWithSignature(chainId, nonce, proposalData, resourceId, sig);
    const receipt = await tx.wait();
    
    return receipt;
  }

  
  
}
