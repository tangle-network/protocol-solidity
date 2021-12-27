import { BigNumberish, ethers } from "ethers";
import { SignatureBridge, SignatureBridge__factory } from '../../../typechain';
import { Anchor } from './Anchor';
import { LinkableTreeHandler } from "./LinkableTreeHandler";
import { GovernedTokenWrapper } from "../../tokens/src/index";
import { TokenWrapperHandler } from "../../tokens/src/index";

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
  handler: LinkableTreeHandler | TokenWrapperHandler;
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
    const deployedBridge = await bridgeFactory.deploy(initialGovernor);
    await deployedBridge.deployed();
    const bridgeSide = new SignatureBridgeSide(deployedBridge, admin);
    return bridgeSide;
  }

  public static async connect(address: string, admin: ethers.Signer) {
    const deployedBridge = SignatureBridge__factory.connect(address, admin);
    const bridgeSide = new SignatureBridgeSide(deployedBridge, admin);
    return bridgeSide;
  }

  /**
   * Creates the proposal data for updating an execution anchor
   * with the latest state of a source anchor (i.e. most recent deposit).
   * @param srcAnchor The anchor instance whose state has updated.
   * @param executionResourceId The resource id of the execution anchor instance.
   * @returns Promise<string>
   */
   public async createAnchorUpdateProposalData(srcAnchor: Anchor, executionResourceID: string): Promise<string> {
    const proposalData = await srcAnchor.getProposalData(executionResourceID);
    return proposalData;
  }

  /**
   * Creates the proposal data for updating the wrapping fee
   * of a governed token wrapper.
   * @param governedToken The governed token wrapper whose fee will be updated.
   * @param fee The new fee percentage
   * @returns Promise<string>
   */
   public async createFeeUpdateProposalData(governedToken: GovernedTokenWrapper, fee: number): Promise<string> {
    // TODO: Validate fee is between [0, 100]
    const proposalData = await governedToken.getFeeProposalData(fee);
    return proposalData;
  }

  public async createAddTokenUpdateProposalData(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    const proposalData = await governedToken.getAddTokenProposalData(tokenAddress);
    return proposalData;
  }

  public async createRemoveTokenUpdateProposalData(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    const proposalData = await governedToken.getRemoveTokenProposalData(tokenAddress);
    return proposalData;
  }

  public async setLinkableTreeHandler(handler: LinkableTreeHandler) {
    this.handler = handler;
  }

  public async setTokenWrapperHandler(handler: TokenWrapperHandler) {
    this.handler = handler;
  }

  // Connects the bridgeSide, anchor handler, and anchor.
  // Returns the resourceID used to connect them all
  public async connectAnchorWithSignature(anchor: Anchor): Promise<string> {
    const resourceId = await this.setResourceWithSignature(anchor);
    await anchor.setHandler(this.handler.contract.address);

    return resourceId;
  }

  public async setResourceWithSignature(anchor: Anchor): Promise<string> {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }
    const resourceId = await anchor.createResourceId();
    //console.log("resourceID", resourceId);
    //console.log("handler address", this.handler.contract.address);
    const unsignedData = this.handler.contract.address + resourceId.slice(2) + anchor.contract.address.slice(2);
    const unsignedMsg = ethers.utils.arrayify(ethers.utils.keccak256(unsignedData).toString());
    const sig = await this.signingSystemSignFn(unsignedMsg);
    await this.contract.adminSetResourceWithSignature(this.handler.contract.address, resourceId, anchor.contract.address, sig);
    return resourceId;
  }

  public async setGovernedTokenResourceWithSignature(governedToken: GovernedTokenWrapper): Promise<string> {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }
    const resourceId = await governedToken.createResourceId();
    const unsignedData = this.handler.contract.address + resourceId.slice(2) + governedToken.contract.address.slice(2);
    const unsignedMsg = ethers.utils.arrayify(ethers.utils.keccak256(unsignedData).toString());
    const sig = await this.signingSystemSignFn(unsignedMsg);
    await this.contract.adminSetResourceWithSignature(this.handler.contract.address, resourceId, governedToken.contract.address, sig);
    return resourceId;
  }

  // emit ProposalEvent(chainID, nonce, ProposalStatus.Executed, dataHash);
  public async executeAnchorProposalWithSig(srcAnchor: Anchor, executionResourceID: string) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createAnchorUpdateProposalData(srcAnchor, executionResourceID);
    const proposalMsg = ethers.utils.arrayify(ethers.utils.keccak256(proposalData).toString());
    const sig = await this.signingSystemSignFn(proposalMsg);
    const tx = await this.contract.executeProposalWithSignature(proposalData, sig);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async executeFeeProposalWithSig(governedToken: GovernedTokenWrapper, fee: number) {
    if (!this.handler) {
      throw new Error("Cannot connect to token wrapper without a handler");
    }
    const proposalData = await this.createFeeUpdateProposalData(governedToken, fee);
    const proposalMsg = ethers.utils.arrayify(ethers.utils.keccak256(proposalData).toString());
    const sig = await this.signingSystemSignFn(proposalMsg);
    const tx = await this.contract.executeProposalWithSignature(proposalData, sig);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async executeAddTokenProposalWithSig(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    if (!this.handler) {
      throw new Error("Cannot connect to token wrapper without a handler");
    }

    const proposalData = await this.createAddTokenUpdateProposalData(governedToken, tokenAddress);
    const proposalMsg = ethers.utils.arrayify(ethers.utils.keccak256(proposalData).toString());
    const sig = await this.signingSystemSignFn(proposalMsg);
    const tx = await this.contract.executeProposalWithSignature(proposalData, sig);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async executeRemoveTokenProposalWithSig(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    if (!this.handler) {
      throw new Error("Cannot connect to token wrapper without a handler");
    }

    const proposalData = await this.createRemoveTokenUpdateProposalData(governedToken, tokenAddress);
    const resourceId = await governedToken.createResourceId();
    const chainId = await governedToken.signer.getChainId();
    const nonce = (await governedToken.contract.proposalNonce()).add(1);
    const proposalMsg = ethers.utils.arrayify(ethers.utils.keccak256(proposalData).toString());
    const sig = await this.signingSystemSignFn(proposalMsg);
    const tx = await this.contract.executeProposalWithSignature(proposalData, sig);
    const receipt = await tx.wait();
    
    return receipt;
  }
}
