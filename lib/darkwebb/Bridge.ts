import { ethers } from "ethers";
import BridgeSide from './BridgeSide';
import Anchor from './Anchor';

class Bridge {
  constructor(
    // Mapping of ChainIDs to BridgeSides
    public bridgeSides: Map<number, BridgeSide>,

    // Mapping of ChainIDs to Anchors
    public anchors: Map<number, Anchor>,
  ) {}

  public static init(bridgeSides: Map<number, BridgeSide>, anchors: Map<number, Anchor>) {

  }

  /** Update the state of BridgeSides and Anchors, when
  *** state changes for the provided @param chainId 
  **/
  public update(chainId: number) {
    
  }
}

export default Bridge;
