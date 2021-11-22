import { ethers } from "ethers";
import { Bridge } from '../../typechain/Bridge';
import VAnchor from './VAnchor';
import { Bridge__factory } from '../../typechain/factories/Bridge__factory';
import AnchorHandler from "../fixed-bridge/AnchorHandler";

type Proposal = {
  data: string,
  dataHash: string,
  resourceId: string,
  chainId: number,
  leafIndex: number,
}

class VBridgeSide {
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

  /** Update proposals are created so that changes to an anchor's root chain Y can
  *** make its way to the neighbor root of the linked anchor on chain X.
  *** @param linkedAnchorInstance: the anchor instance on the opposite chain
  ***/
  public async createUpdateProposalData(linkedAnchorInstance: VAnchor) {
    const proposalData = await linkedAnchorInstance.getProposalData();
    return proposalData;
  }

  public async setAnchorHandler(handler: AnchorHandler) {
    this.handler = handler;
  }

  // Connects the vBridgeSide, anchor handler, and anchor.
  // Returns the resourceID used to connect them all
  public async connectAnchor(anchor: VAnchor): Promise<string> {
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

  // the 'linkedAnchor' is the anchor which exists on a chain other than this bridge's
  // the 'thisAnchor' is the anchor on the same chain as this bridge.
  // nonce is leafIndex from linkedAnchor
  // chainId from linked anchor
  // resourceId for this anchor
  // dataHash is combo of keccak('anchor handler for this bridge' + (chainID linkedAnchor + leafIndex linkedAnchor + root linkedAnchor))
  public async voteProposal(linkedAnchor: VAnchor, thisAnchor: VAnchor) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createUpdateProposalData(linkedAnchor);
    const dataHash = ethers.utils.keccak256(this.handler.contract.address + proposalData.substr(2));
    const resourceId = await thisAnchor.createResourceId();
    const chainId = await linkedAnchor.signer.getChainId();
    const nonce = linkedAnchor.tree.number_of_elements() - 1;

    const tx = await this.contract.voteProposal(chainId, nonce, resourceId, dataHash);
    const receipt = await tx.wait();
    
    return receipt;
  }

  // emit ProposalEvent(chainID, nonce, ProposalStatus.Executed, dataHash);
  public async executeProposal(linkedAnchor: VAnchor, thisAnchor: VAnchor) {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const proposalData = await this.createUpdateProposalData(linkedAnchor);
    const resourceId = await thisAnchor.createResourceId();
    const chainId = await linkedAnchor.signer.getChainId();
    const nonce = linkedAnchor.tree.number_of_elements() - 1;

    const tx = await this.contract.executeProposal(chainId, nonce, proposalData, resourceId);
    const receipt = await tx.wait();
    
    return receipt;
  }
}

export default VBridgeSide;
