import { ethers } from 'ethers';
import { Bridge, Bridge__factory  } from '@webb-tools/contracts';
import { AnchorHandler } from '@webb-tools/anchors';
import { IAnchor, Proposal } from '@webb-tools/interfaces';

export class VBridgeSide {
  contract: Bridge;
  admin: ethers.Signer;
  handler: AnchorHandler | null;
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

  public static async createVBridgeSide(
    initialRelayers: string[],
    initialRelayerThreshold: ethers.BigNumberish,
    fee: ethers.BigNumberish,
    expiry: ethers.BigNumberish,
    admin: ethers.Signer
  ): Promise<VBridgeSide> {
    const bridgeFactory = new Bridge__factory(admin);
    const chainId = await admin.getChainId();
    const deployedBridge = await bridgeFactory.deploy(chainId, initialRelayers, initialRelayerThreshold, fee, expiry);
    await deployedBridge.deployed();
    const vBridgeSide = new VBridgeSide(deployedBridge, admin);
    return vBridgeSide;
  }

  public static async connect(address: string, admin: ethers.Signer) {
    const deployedBridge = Bridge__factory.connect(address, admin);
    const vBridgeSide = new VBridgeSide(deployedBridge, admin);
    return vBridgeSide;
  }

  /**
   * Creates the proposal data for updating an execution anchor
   * with the latest state of a source anchor (i.e. most recent deposit).
   * @param srcAnchor The anchor instance whose state has updated.
   * @param executionResourceId The resource id of the execution anchor instance.
   * @returns Promise<string>
   */
   public async createAnchorUpdateProposalData(srcAnchor: IAnchor, executionResourceID: string): Promise<string> {
    const proposalData = await srcAnchor.getProposalData(executionResourceID);
    return proposalData;
  }

  public async createHandlerUpdateProposalData(vAnchor: IAnchor, newHandler: string) {
    const proposalData = await vAnchor.getHandlerProposalData(newHandler);
    return proposalData;
  }

  public async createConfigLimitsProposalData(vAnchor: IAnchor, _minimalWithdrawalAmount: string, _maximumDepositAmount: string) {
    const proposalData = await vAnchor.getConfigLimitsProposalData(_minimalWithdrawalAmount,_maximumDepositAmount);
    return proposalData;
  }

  public setAnchorHandler(handler: AnchorHandler) {
    this.handler = handler;
  }

  // Connects the vBridgeSide, anchor handler, and anchor.
  // Returns the resourceID used to connect them all
  public async connectAnchor(anchor: IAnchor): Promise<string> {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const resourceId = await anchor.createResourceId();
    const tx = await this.contract.adminSetResource(this.handler.contract.address, resourceId, anchor.contract.address);
    await tx.wait();
    await this.voteHandlerProposal(anchor, this.handler.contract.address);
    await this.executeHandlerProposal(anchor, this.handler.contract.address);

    return resourceId;
  }

  /**
   * Votes on an anchor proposal by creating the proposal data and submitting it to the bridge.
   * @param srcAnchor The anchor instance whose state has updated.
   * @param executionResourceID The resource id of the execution anchor instance.
   * @returns 
   */
  public async voteAnchorProposal(srcAnchor: IAnchor, executionResourceID: string) {
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

  // emit ProposalEvent(chainID, nonce, ProposalStatus.Executed, dataHash);
  public async executeProposal(srcAnchor: IAnchor, executionResourceId: string) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }
    
    const proposalData = await this.createAnchorUpdateProposalData(srcAnchor, executionResourceId);
    const chainId = await srcAnchor.signer.getChainId();
    const nonce = srcAnchor.tree.number_of_elements() - 1;
    const tx = await this.contract.executeProposal(chainId, nonce, proposalData, executionResourceId);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async voteHandlerProposal(anchor: IAnchor, newHandler: string) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createHandlerUpdateProposalData(anchor, newHandler);
    const dataHash = ethers.utils.keccak256(this.handler.contract.address + proposalData.substr(2));
    
    const chainId = await anchor.signer.getChainId();
    const nonce = 1;
    const resourceID = await anchor.createResourceId();
    const tx = await this.contract.voteProposal(chainId, nonce, resourceID, dataHash);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async executeHandlerProposal(anchor: IAnchor, newHandler: string) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createHandlerUpdateProposalData(anchor, newHandler);
    const chainId = await anchor.signer.getChainId();
    const nonce = 1;
    const resourceID = await anchor.createResourceId()
    const tx = await this.contract.executeProposal(chainId, nonce, proposalData, resourceID);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async voteConfigLimitsProposal(anchor: IAnchor, _minimalWithdrawalAmount: string, _maximumDepositAmount: string) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createConfigLimitsProposalData(anchor, _minimalWithdrawalAmount, _maximumDepositAmount);
    const dataHash = ethers.utils.keccak256(this.handler.contract.address + proposalData.substr(2));
    
    const chainId = await anchor.signer.getChainId();
    const nonce = 1;
    const resourceID = await anchor.createResourceId();
    const tx = await this.contract.voteProposal(chainId, nonce, resourceID, dataHash);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async executeConfigLimitsProposal(anchor: IAnchor, _minimalWithdrawalAmount: string, _maximumDepositAmount: string) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createConfigLimitsProposalData(anchor, _minimalWithdrawalAmount,_maximumDepositAmount);
    const chainId = await anchor.signer.getChainId();
    const nonce = 1;
    const resourceID = await anchor.createResourceId()
    const tx = await this.contract.executeProposal(chainId, nonce, proposalData, resourceID);
    const receipt = await tx.wait();
    
    return receipt;
  }
}

export default VBridgeSide;
