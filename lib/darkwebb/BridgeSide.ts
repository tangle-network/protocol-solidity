import { ethers } from "ethers";
import { Bridge } from '../../typechain/Bridge';
import Anchor from './Anchor';
import { Bridge__factory } from '../../typechain/factories/Bridge__factory';
import { AnchorHandler } from "../../typechain/AnchorHandler";

class BridgeSide {
  contract: Bridge;
  admin: ethers.Signer;
  handler: AnchorHandler | null;

  private constructor(
    contract: Bridge,
    signer: ethers.Signer,
  ) {
    this.contract = contract;
    this.admin = signer;
    this.handler = null;
  }

  public static async createBridgeSide(
    initialRelayers: string[],
    initialRelayerThreshold: ethers.BigNumberish,
    fee: ethers.BigNumberish,
    expiry: ethers.BigNumberish,
    signer: ethers.Signer
  ): Promise<BridgeSide> {
    const bridgeFactory = new Bridge__factory(signer);
    const chainId = await signer.getChainId();
    const deployedBridge = await bridgeFactory.deploy(chainId, initialRelayers, initialRelayerThreshold, fee, expiry);
    await deployedBridge.deployed();
    console.log(`Deployed Bridge: ${deployedBridge.address}`);
    const bridgeSide = new BridgeSide(deployedBridge, signer);
    return bridgeSide;
  }

  /** Update proposals are created so that changes to an anchor's root chain Y can
  *** make its way to the neighbor root of the linked anchor on chain X.
  *** @param linkedAnchorInstance: the anchor instance on the opposite chain
  ***/
  public static async createUpdateProposalDatahash(linkedAnchorInstance: Anchor, handlerAddress: string) {
    const proposalData = await linkedAnchorInstance.getProposalData();
    const dataHash = ethers.utils.keccak256(handlerAddress + (await proposalData).substr(2));
    return dataHash;
    // const resourceId = createResourceId(linkedAnchorInstance.contract.address, (await this.admin.getChainId));
    // this.contract.voteProposal((await linkedAnchorInstance.signer.getChainId()), nonce, resourceId, dataHash);
  }
}

export default BridgeSide;
