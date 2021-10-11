import { ethers } from "ethers";
import { Bridge } from '../../typechain/Bridge';
import Anchor from './Anchor';
import { Bridge__factory } from '../../typechain/factories/Bridge__factory';
import { AnchorHandler } from "../../typechain/AnchorHandler";

class BridgeSide {
  contract: Bridge;
  admin: ethers.Signer;
  provider: ethers.providers.JsonRpcProvider;
  handler: AnchorHandler | null;

  private constructor(
    contract: Bridge,
    provider: ethers.providers.JsonRpcProvider,
    signer: ethers.Signer,
  ) {
    this.contract = contract;
    this.provider = provider;
    this.admin = signer;
    this.handler = null;
  }

  public static async createBridgeSide(
    initialRelayers: string[],
    initialRelayerThreshold: ethers.BigNumberish,
    fee: ethers.BigNumberish,
    expiry: ethers.BigNumberish,
    provider: ethers.providers.JsonRpcProvider,
    signer: ethers.Signer
  ): Promise<BridgeSide> {
    const bridgeFactory = new Bridge__factory(signer);
    const chainId = await signer.getChainId();
    const deployedBridge = await bridgeFactory.deploy(chainId, initialRelayers, initialRelayerThreshold, fee, expiry);
    await deployedBridge.deployed();
    console.log(`Deployed Bridge: ${deployedBridge.address}`);
    const bridgeSide = new BridgeSide(deployedBridge, provider, signer);
    return bridgeSide;
  }

  /** Update proposals are created so that changes to an anchor's root chain Y can
  *** make its way to the neighbor root of the linked anchor on chain X.
  *** @param linkedAnchorInstance: the anchor instance on the opposite chain
  ***/
  public async createUpdateProposalDatahash(linkedAnchorInstance: Anchor) {
    if (!this.handler) {
      throw new Error("Cannot create a proposal without a handler");
    }

    const proposalData = await linkedAnchorInstance.getProposalData();
    const dataHash = ethers.utils.keccak256(this.handler.address + proposalData.substr(2));
    return dataHash;
    // this.contract.voteProposal((await linkedAnchorInstance.signer.getChainId()), nonce, resourceId, dataHash);
  }

  public setHandler(handler: AnchorHandler) {
    this.handler = handler;
  } 

  public async setResource(resourceID: string, handlerAddress: string, anchorAddress) {
    
  }

  // Connects the bridgeSide, anchor handler, and anchor.
  // Returns the resourceID used to connect them all
  public async connectAnchor(anchor: Anchor): Promise<string> {
    if (!this.handler) {
      throw new Error("Cannot connect an anchor without a handler");
    }

    const resourceId = await anchor.createResourceId();
    await this.contract.adminSetResource(this.handler.address, resourceId, anchor.contract.address);
    // await this.handler.setResource(resourceId, anchor.contract.address);
    await anchor.setHandler(this.handler.address);

    return resourceId;
  }

  public async voteProposal(linkedAnchor: Anchor) {
    const dataHash = this.createUpdateProposalDatahash(linkedAnchor);
    // The nonce is the leafIndex 
    const latestNonce = linkedAnchor.numberOfLeaves - 1;

  }
}

export default BridgeSide;
