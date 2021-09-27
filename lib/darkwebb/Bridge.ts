import { ethers } from "ethers";
import BridgeSide from './BridgeSide';
import Anchor from './Anchor';
import AnchorHandler from "./AnchorHandler";
import { AnchorHandler__factory } from '../../typechain/factories/AnchorHandler__factory';

class Bridge {
  private constructor(
    // Mapping of chainId => linkedBridgeSides
    public linkedBridgeSides: Map<number, BridgeSide[]>,

    // Mapping of chainId => linkedAnchors; so we know which
    // anchors need updating when passed the chainId.
    public linkedAnchorMap: Map<number, Anchor[]>,
  ) {}

  public static createLinkedAnchorMap(map: Map<number, Anchor>): Map<number, Anchor[]> {

    let linkedAnchorMap = new Map<number, Anchor[]>();

    map.forEach((entry, key) => {
      // get the rest of the anchors
      let linkedAnchors: Anchor[] = (Object.values(map) as Anchor[]).filter(anchor =>
        anchor != entry
      );

      // insert the linked anchors into the linked map
      linkedAnchorMap.set(key, linkedAnchors);
    })

    return linkedAnchorMap;
  }

  public static createLinkedBridgeSideMap(map: Map<number, BridgeSide>) {
    let linkedBridgeSideMap = new Map<number, BridgeSide[]>();

    map.forEach((entry, key) => {
      // get the rest of the bridge sides
      let linkedBridgeSides: BridgeSide[] = (Object.values(map) as BridgeSide[]).filter(side =>
        side != entry
      );

      // insert the linked bridge sides into the linked map
      linkedBridgeSideMap.set(key, linkedBridgeSides);
    })

    return linkedBridgeSideMap;
  }

  // The init method accepts initialized bridgeSides and anchors indexed by chainID.
  // it creates the anchor handlers and links the anchors together.
  // it re-indexes anchors under the appropriate resourceID.
  // finally, it creates the instance of the Bridge.
  public static async init(bridgeSides: Map<number, BridgeSide>, anchors: Map<number, Anchor>) {

    bridgeSides.forEach(async (entry, chainId) => {
      const chainAnchor = anchors.get(chainId);
      const resourceID = await chainAnchor.createResourceId();

      const handler = await AnchorHandler.createAnchorHandler(entry.contract.address, [resourceID], [chainAnchor.contract.address], entry.admin);
      
      await entry.setHandler(handler.contract);
      await entry.connectAnchor(chainAnchor);
    })

    const linkedBridgeSides = this.createLinkedBridgeSideMap(bridgeSides);
    const linkedAnchors = this.createLinkedAnchorMap(anchors);

    return new Bridge(linkedBridgeSides, linkedAnchors);
  }

  /** Update the state of BridgeSides and Anchors, when
  *** state changes for the @param linkedAnchor 
  **/
  public async update(linkedAnchor: Anchor) {
    // Find the bridge sides that are connected to this Anchor
    const changedChainId = await linkedAnchor.signer.getChainId();
    const bridgeSidesToUpdate = this.linkedBridgeSides.get(changedChainId);

    // update the sides
    bridgeSidesToUpdate.forEach((side) => {
      // create the proposal data hash to vote on
      const proposalDataHash = side.createUpdateProposalDatahash(linkedAnchor);

      // Vote and execute

    })
  }

}

export default Bridge;
