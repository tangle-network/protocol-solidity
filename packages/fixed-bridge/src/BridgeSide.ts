import { ethers } from "ethers";
import { Bridge, Bridge__factory } from '@webb-tools/contracts';
import { Anchor } from './Anchor';
import { AnchorHandler } from "./AnchorHandler";
import { GovernedTokenWrapper } from "../../tokens/src/index";
import { TokenWrapperHandler } from "../../tokens/src/index";

export type Proposal = {
  data: string,
  dataHash: string,
  resourceId: string,
  chainId: number,
  leafIndex: number,
}

export class BridgeSide {
  contract: Bridge;
  admin: ethers.Signer;
  handler: AnchorHandler | TokenWrapperHandler | null;
  proposals: Proposal[];

  private constructor(
    contract: Bridge,
    signer: ethers.Signer,
  ) {
    this.contract = contract;
    this.admin = signer;
    this.handler = null;
    this.proposals = [];
  }

  public static async createBridgeSide(
    initialRelayers: string[],
    initialRelayerThreshold: ethers.BigNumberish,
    fee: ethers.BigNumberish,
    expiry: ethers.BigNumberish,
    admin: ethers.Signer
  ): Promise<BridgeSide> {
    const bridgeFactory = new Bridge__factory(admin);
    const chainId = await admin.getChainId();
    const deployedBridge = await bridgeFactory.deploy(chainId, initialRelayers, initialRelayerThreshold, fee, expiry);
    await deployedBridge.deployed();
    const bridgeSide = new BridgeSide(deployedBridge, admin);
    return bridgeSide;
  }

  public static async connect(address: string, admin: ethers.Signer) {
    const deployedBridge = Bridge__factory.connect(address, admin);
    const bridgeSide = new BridgeSide(deployedBridge, admin);
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

  public async setAnchorHandler(handler: AnchorHandler) {
    this.handler = handler;
  }

  public async setTokenWrapperHandler(handler: TokenWrapperHandler) {
    this.handler = handler;
  }

  // Connects the bridgeSide, anchor handler, and anchor.
  // Returns the resourceID used to connect them all
  public async connectAnchor(anchor: Anchor): Promise<string> {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const resourceId = await anchor.createResourceId();
    await this.contract.adminSetResource(this.handler.contract.address, resourceId, anchor.contract.address);
    // await this.handler.setResource(resourceId, anchor.contract.address); covered in above call
    await anchor.setHandler(this.handler.contract.address);
    await anchor.setBridge(this.contract.address);

    return resourceId;
  }

  public async setGovernedTokenResource(governedToken: GovernedTokenWrapper): Promise<string> {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }
    const resourceId = await governedToken.createResourceId();

    await this.contract.adminSetResource(this.handler.contract.address, resourceId, governedToken.contract.address);
    return resourceId;
  }

  /**
   * Votes on an anchor proposal by creating the proposal data and submitting it to the bridge.
   * @param srcAnchor The anchor instance whose state has updated.
   * @param executionResourceID The resource id of the execution anchor instance.
   * @returns 
   */
  public async voteAnchorProposal(srcAnchor: Anchor, executionResourceID: string) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createAnchorUpdateProposalData(srcAnchor, executionResourceID);
    const dataHash = ethers.utils.keccak256(this.handler.contract.address + proposalData.substr(2));
    
    const chainId = await srcAnchor.signer.getChainId();
    const nonce = srcAnchor.tree.number_of_elements() - 1;

    const tx = await this.contract.voteProposal(chainId, nonce, executionResourceID, dataHash);
    const receipt = await tx.wait();
    
    return receipt;
  }

  /**
   * Executes a proposal by calling the bridge's executeProposal function
   * with the anchor update proposal data.
   * @param srcAnchor The anchor instance whose state has updated.
   * @param executionResourceID The resource id of the execution anchor instance.
   * @returns 
   */
  public async executeAnchorProposal(srcAnchor: Anchor, executionResourceID: string) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createAnchorUpdateProposalData(srcAnchor, executionResourceID);
    const chainId = await srcAnchor.signer.getChainId();
    const nonce = srcAnchor.tree.number_of_elements() - 1;

    const tx = await this.contract.executeProposal(chainId, nonce, proposalData, executionResourceID);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async voteFeeProposal(governedToken: GovernedTokenWrapper, fee: number) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createFeeUpdateProposalData(governedToken, fee);
    const dataHash = ethers.utils.keccak256(this.handler.contract.address + proposalData.substr(2));
    const resourceId = await governedToken.createResourceId();
    const chainId = await governedToken.signer.getChainId();
    const nonce = (await governedToken.contract.proposalNonce()).add(1);

    const tx = await this.contract.voteProposal(chainId, nonce, resourceId, dataHash);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async executeFeeProposal(governedToken: GovernedTokenWrapper, fee: number) {
    if (!this.handler) {
      throw new Error("Cannot connect to token wrapper without a handler");
    }
    const proposalData = await this.createFeeUpdateProposalData(governedToken, fee);
    const resourceId = await governedToken.createResourceId();
    const chainId = await governedToken.signer.getChainId();
    const nonce = (await governedToken.contract.proposalNonce()).add(1);
    const tx = await this.contract.executeProposal(chainId, nonce, proposalData, resourceId);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async voteAddTokenProposal(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createAddTokenUpdateProposalData(governedToken, tokenAddress);
    const dataHash = ethers.utils.keccak256(this.handler.contract.address + proposalData.substr(2));
    const resourceId = await governedToken.createResourceId();
    const chainId = await governedToken.signer.getChainId();
    const nonce = (await governedToken.contract.proposalNonce()).add(1);

    const tx = await this.contract.voteProposal(chainId, nonce, resourceId, dataHash);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async executeAddTokenProposal(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    if (!this.handler) {
      throw new Error("Cannot connect to token wrapper without a handler");
    }

    const proposalData = await this.createAddTokenUpdateProposalData(governedToken, tokenAddress);
    const resourceId = await governedToken.createResourceId();
    const chainId = await governedToken.signer.getChainId();
    const nonce = (await governedToken.contract.proposalNonce()).add(1);
    const tx = await this.contract.executeProposal(chainId, nonce, proposalData, resourceId);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async voteRemoveTokenProposal(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createRemoveTokenUpdateProposalData(governedToken, tokenAddress);
    const dataHash = ethers.utils.keccak256(this.handler.contract.address + proposalData.substr(2));
    const resourceId = await governedToken.createResourceId();
    const chainId = await governedToken.signer.getChainId();
    const nonce = (await governedToken.contract.proposalNonce()).add(1);

    const tx = await this.contract.voteProposal(chainId, nonce, resourceId, dataHash);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async executeRemoveTokenProposal(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    if (!this.handler) {
      throw new Error("Cannot connect to token wrapper without a handler");
    }

    const proposalData = await this.createRemoveTokenUpdateProposalData(governedToken, tokenAddress);
    const resourceId = await governedToken.createResourceId();
    const chainId = await governedToken.signer.getChainId();
    const nonce = (await governedToken.contract.proposalNonce()).add(1);
    const tx = await this.contract.executeProposal(chainId, nonce, proposalData, resourceId);
    const receipt = await tx.wait();
    
    return receipt;
  }
}
