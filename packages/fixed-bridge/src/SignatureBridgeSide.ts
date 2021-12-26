import { BigNumberish, ethers } from "ethers";
import { SignatureBridge, SignatureBridge__factory } from '../../../typechain';
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

export class SignatureBridgeSide {
  contract: SignatureBridge;
  admin: ethers.Signer;
  handler: AnchorHandler | TokenWrapperHandler;
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
  public async createAnchorUpdateProposalData(linkedAnchorInstance: Anchor, thisAnchorInstance: Anchor) {
    const proposalData = await linkedAnchorInstance.getProposalData(thisAnchorInstance);
    return proposalData;
  }

  public async createFeeUpdateProposalData(governedToken: GovernedTokenWrapper, fee: number) {
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
  public async executeAnchorProposalWithSig(linkedAnchor: Anchor, thisAnchor: Anchor) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createAnchorUpdateProposalData(linkedAnchor, thisAnchor);
    const chainId = await linkedAnchor.signer.getChainId();
    const nonce = linkedAnchor.tree.number_of_elements() - 1;
    const proposalMsg = ethers.utils.arrayify(ethers.utils.keccak256(proposalData).toString());
    const sig = await this.signingSystemSignFn(proposalMsg);
    const tx = await this.contract.executeProposalWithSignature(chainId, proposalData, sig);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async executeFeeProposalWithSig(governedToken: GovernedTokenWrapper, fee: number) {
    if (!this.handler) {
      throw new Error("Cannot connect to token wrapper without a handler");
    }
    const proposalData = await this.createFeeUpdateProposalData(governedToken, fee);
    const resourceId = await governedToken.createResourceId();
    const chainId = await governedToken.signer.getChainId();
    const nonce = (await governedToken.contract.storageNonce()).add(1);
    const proposalMsg = ethers.utils.arrayify(ethers.utils.keccak256(proposalData).toString());
    const sig = await this.signingSystemSignFn(proposalMsg);
    const tx = await this.contract.executeProposalWithSignature(chainId, proposalData, sig);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public async executeAddTokenProposalWithSig(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    if (!this.handler) {
      throw new Error("Cannot connect to token wrapper without a handler");
    }

    const proposalData = await this.createAddTokenUpdateProposalData(governedToken, tokenAddress);
    const resourceId = await governedToken.createResourceId();
    const chainId = await governedToken.signer.getChainId();
    const nonce = (await governedToken.contract.storageNonce()).add(1);
    const proposalMsg = ethers.utils.arrayify(ethers.utils.keccak256(proposalData).toString());
    const sig = await this.signingSystemSignFn(proposalMsg);
    const tx = await this.contract.executeProposalWithSignature(chainId, proposalData, sig);
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
    const nonce = (await governedToken.contract.storageNonce()).add(1);
    const proposalMsg = ethers.utils.arrayify(ethers.utils.keccak256(proposalData).toString());
    const sig = await this.signingSystemSignFn(proposalMsg);
    const tx = await this.contract.executeProposalWithSignature(chainId, proposalData, sig);
    const receipt = await tx.wait();
    
    return receipt;
  }
}
