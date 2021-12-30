import { ethers, BigNumber, BigNumberish  } from "ethers";
import VBridgeSide from './VBridgeSide';
import VAnchor from './VAnchor';
import { AnchorHandler } from "./AnchorHandler";
import { MintableToken, GovernedTokenWrapper } from "../../tokens/src/index";
import { PoseidonT3__factory } from "@webb-tools/contracts";
import Verifier from "./Verifier";
import { Utxo } from "./utxo";

// Deployer config matches the chainId to the signer for that chain
export type DeployerConfig = Record<number, ethers.Signer>;

type VAnchorIdentifier = {
  chainId: number;
};

// The AnchorMetadata holds information about anchors such as:
//   - The amount they hold
// type AnchorMetadata = {
//   tokenType: TokenType,
//   depositedAmount: ethers.BigNumberish,
// }

// type AnchorWithMetadata = {
//   metadata: AnchorWithMetadata;
//   anchor: Anchor;
// }

// enum TokenType {
//   webb,
//   erc20,
//   native,
// };

type AnchorQuery = {
  chainId?: number;
  tokenAddress?: string;
}

export type ExistingAssetInput = {
  // A record of chainId => address
  asset: Record<number, string[]>;
}

// Users define an input for a completely new bridge
export type VBridgeInput = {

  // The tokens and anchors which should be supported after deploying from this bridge input
  vAnchorInputs: ExistingAssetInput,

  // The IDs of the chains to deploy to
  chainIDs: number[],

  webbTokens: Map<number, GovernedTokenWrapper | undefined>;
};

export type BridgeConfig = {

  // The addresses of tokens available to be transferred over this bridge config
  // chainId => GovernedTokenWrapperAddress
  webbTokenAddresses: Map<number, string | undefined>;

  // The addresses of the anchors for the GovernedTokenWrapper
  // {anchorIdentifier} => anchorAddress
  vAnchors: Map<string, VAnchor>,

  // The addresses of the Bridge contracts (bridgeSides) to interact with
  vBridgeSides: Map<number, VBridgeSide>,
}

const zeroAddress = "0x0000000000000000000000000000000000000000";

function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}

// A bridge is 
export class VBridge {
  private constructor(
    // Mapping of chainId => vBridgeSide
    public vBridgeSides: Map<number, VBridgeSide>,

    // chainID => GovernedTokenWrapper (webbToken) address
    public webbTokenAddresses: Map<number, string>,

    // Mapping of resourceID => linkedVAnchor[]; so we know which
    // vanchors need updating when the anchor for resourceID changes state.
    public linkedVAnchors: Map<string, VAnchor[]>,

    // Mapping of anchorIdString => Anchor for easy anchor access
    public vAnchors: Map<string, VAnchor>,
  ) {}

  //might need some editing depending on whether anchor identifier structure changes
  public static createVAnchorIdString(vAnchorIdentifier: VAnchorIdentifier): string {
    return `${vAnchorIdentifier.chainId.toString()}`;
  }

  public static createVAnchorIdentifier(vAnchorString: string): VAnchorIdentifier | null {
    // const identifyingInfo = anchorString.split('-');
    // if (identifyingInfo.length != 2) {
    //   return null;
    // }
    return {
      chainId: Number(vAnchorString)
    }
  }

  // Takes as input a 2D array [[anchors to link together], [...]]
  // And returns a map of resourceID => linkedAnchor[]
  public static async createLinkedVAnchorMap(createdVAnchors: VAnchor[][]): Promise<Map<string, VAnchor[]>> {
    let linkedVAnchorMap = new Map<string, VAnchor[]>();
    for (let groupedVAnchors of createdVAnchors) {
      for (let i=0; i<groupedVAnchors.length; i++) {
        // create the resourceID of this anchor
        let resourceID = await groupedVAnchors[i].createResourceId();
        let linkedVAnchors = [];
        for (let j = 0; j < groupedVAnchors.length; j++) {
          if (i != j) {
            linkedVAnchors.push(groupedVAnchors[j]);
          }
        }
        // insert the linked anchors into the linked map
        linkedVAnchorMap.set(resourceID, linkedVAnchors);
      }
    }
    return linkedVAnchorMap;
  }

  // public static async connectBridge(bridgeConfig: BridgeConfig) {
  //   // Parse the anchorIdStrings into achor identifiers
  //   let identifiedAnchors: AnchorIdentifier[] = [];
  //   for (const key of bridgeConfig.anchors.keys()) {
  //     const createdAnchorIdentifier = Bridge.createAnchorIdentifier(key);
  //     if (createdAnchorIdentifier) {
  //       identifiedAnchors.push(createdAnchorIdentifier);
  //     }
  //   }

  //   // loop through and group anchors by their identifiers
  //   let groupLinkedAnchors: Anchor[][] = [];

  //   for (const anchor of identifiedAnchors) {
  //     let anchorGroup: Anchor[] = [];

  //     for (const linkableAnchor of identifiedAnchors) {
  //       if (
  //         anchor.tokenName == linkableAnchor.tokenName && 
  //         anchor.anchorSize == linkableAnchor.anchorSize
  //       ) {
  //         anchorGroup.push(bridgeConfig.anchors.get(Bridge.createAnchorIdString(linkableAnchor))!);
  //       }
  //     }

  //     groupLinkedAnchors.push(anchorGroup);
  //   }

  //   const linkedAnchors = await Bridge.createLinkedAnchorMap(groupLinkedAnchors);
    
  //   return new Bridge(bridgeConfig.bridgeSides, bridgeConfig.webbTokenAddresses, linkedAnchors, bridgeConfig.anchors);
  // }

  public static async deployVBridge(vBridgeInput: VBridgeInput, deployers: DeployerConfig): Promise<VBridge> {
    
    let webbTokenAddresses: Map<number, string> = new Map();
    let vBridgeSides: Map<number, VBridgeSide> = new Map();
    let vAnchors: Map<string, VAnchor> = new Map();
    // createdAnchors have the form of [[Anchors created on chainID], [...]]
    // and anchors in the subArrays of thhe same index should be linked together
    let createdVAnchors: VAnchor[][] = [];

    for (let chainID of vBridgeInput.chainIDs) {
      const adminAddress = await deployers[chainID].getAddress();

      // Create the bridgeSide
      const vBridgeInstance = await VBridgeSide.createVBridgeSide(
        [adminAddress],
        1,
        0,
        100,
        deployers[chainID],
      );

      const handler = await AnchorHandler.createAnchorHandler(vBridgeInstance.contract.address, [], [], vBridgeInstance.admin);
      await vBridgeInstance.setAnchorHandler(handler);

      vBridgeSides.set(chainID, vBridgeInstance);
      //console.log(`vBridgeSide address on ${chainID}: ${vBridgeInstance.contract.address}`);

      // Create the Hasher and Verifier for the chain
      const hasherFactory = new PoseidonT3__factory(deployers[chainID]);
      let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
      await hasherInstance.deployed();

      const verifier = await Verifier.createVerifier(deployers[chainID]);
      let verifierInstance = verifier.contract;

      // Check the addresses of the asset. If it is zero, deploy a native token wrapper
      let allowedNative: boolean = false;
      for (const tokenToBeWrapped of vBridgeInput.vAnchorInputs.asset[chainID]!) {
        // If passed '0' or zero address, token to be wrapped should support native.
        if (checkNativeAddress(tokenToBeWrapped)) {
          allowedNative = true;
        }
      }
      let tokenInstance: GovernedTokenWrapper;
      if (!vBridgeInput.webbTokens.get(chainID)) {
        tokenInstance = await GovernedTokenWrapper.createGovernedTokenWrapper(
          `webbETH-test-1`,
          `webbETH-test-1`,
          await deployers[chainID].getAddress(),
          '10000000000000000000000000',
          allowedNative,
          deployers[chainID],
        );
      } else {
        tokenInstance = vBridgeInput.webbTokens.get(chainID)!;
      }

      
      //console.log(`created GovernedTokenWrapper on ${chainID}: ${tokenInstance?.contract.address}`);

      // Add all token addresses to the governed token instance.
      for (const tokenToBeWrapped of vBridgeInput.vAnchorInputs.asset[chainID]!) {
        // if the address is not '0', then add it
        if (!checkNativeAddress(tokenToBeWrapped)) {
          const tx = await tokenInstance?.contract.add(tokenToBeWrapped, (await tokenInstance?.contract.proposalNonce()).add(1));
          const receipt = await tx?.wait();
        }
      }

      // append each token
      webbTokenAddresses.set(
        chainID,
        tokenInstance!.contract.address
      );
      
      let chainGroupedVAnchors: VAnchor[] = [];

      // loop through all the anchor sizes on the token
      
      const vAnchorInstance = await VAnchor.createVAnchor(
          verifierInstance.address,
          5,
          hasherInstance.address,
          handler.contract.address,
          tokenInstance!.contract.address,
          vBridgeInput.chainIDs.length-1,
          deployers[chainID]
      );

      //console.log(`createdVAnchor: ${vAnchorInstance.contract.address}`);

      // grant minting rights to the anchor
      await tokenInstance?.grantMinterRole(vAnchorInstance.contract.address); 

      chainGroupedVAnchors.push(vAnchorInstance);
      vAnchors.set(
          VBridge.createVAnchorIdString({chainId: chainID}),
          vAnchorInstance
      );
      

      await VBridge.setPermissions(vBridgeInstance, chainGroupedVAnchors);
      createdVAnchors.push(chainGroupedVAnchors);
    }

    // All anchors created, massage data to group anchors which should be linked together
    let groupLinkedVAnchors: VAnchor[][] = [];

    // all subarrays will have the same number of elements
    for(let i=0; i<createdVAnchors[0].length; i++) {
      let linkedAnchors: VAnchor[] = [];
      for(let j=0; j<createdVAnchors.length; j++) {
        linkedAnchors.push(createdVAnchors[j][i]);
      }
      groupLinkedVAnchors.push(linkedAnchors);
    }

    // finally, link the anchors
    const linkedVAnchorMap = await VBridge.createLinkedVAnchorMap(groupLinkedVAnchors);
    return new VBridge(vBridgeSides, webbTokenAddresses, linkedVAnchorMap, vAnchors);
  }

  // The setPermissions method accepts initialized bridgeSide and anchors.
  // it creates the anchor handler and sets the appropriate permissions
  // for the bridgeSide/anchorHandler/anchor
  public static async setPermissions(vBridgeSide: VBridgeSide, vAnchors: VAnchor[]): Promise<void> {
    let tokenDenomination = '1000000000000000000' // 1 ether
    for (let vAnchor of vAnchors) {
      await vBridgeSide.connectAnchor(vAnchor);

      await vBridgeSide.voteConfigLimitsProposal(vAnchor, BigNumber.from(0).toString(), BigNumber.from(tokenDenomination).mul(1_000_000).toString());

      await vBridgeSide.executeConfigLimitsProposal(vAnchor, BigNumber.from(0).toString(), BigNumber.from(tokenDenomination).mul(1_000_000).toString());
    }
  }

  /**
  * Updates the state of the BridgeSides and Anchors with
  * the new state of the @param srcAnchor.
  * @param srcAnchor The anchor that has updated.
  * @returns 
  */
   public async updateLinkedVAnchors(srcAnchor: VAnchor) {
    // Find the bridge sides that are connected to this Anchor
    const linkedResourceID = await srcAnchor.createResourceId();
    const vAnchorsToUpdate = this.linkedVAnchors.get(linkedResourceID);
    if (!vAnchorsToUpdate) {
      return;
    }

    // update the sides
    for (let vAnchor of vAnchorsToUpdate) {
      // get the bridge side which corresponds to this anchor
      const chainId = await vAnchor.signer.getChainId();
      const resourceID = await vAnchor.createResourceId();
      const vBridgeSide = this.vBridgeSides.get(chainId);
      await vBridgeSide!.voteAnchorProposal(srcAnchor, resourceID);
      await vBridgeSide!.executeProposal(srcAnchor, resourceID);
    }
  };

  public async update(chainId: number, anchorSize: ethers.BigNumberish) {
    const vAnchor = this.getVAnchor(chainId);
    if (!vAnchor) {
      return;
    }
    await this.updateLinkedVAnchors(vAnchor);
  }

  public getVBridgeSide(chainId: number) {
    return this.vBridgeSides.get(chainId);
  }

  public getVAnchor(chainId: number) {
    let intendedAnchor: VAnchor | undefined = undefined;
    intendedAnchor = this.vAnchors.get(VBridge.createVAnchorIdString({chainId}));
    return intendedAnchor;
  }

  // Returns the address of the webbToken which wraps the given token name.
  public getWebbTokenAddress(chainId: number): string | undefined {
    return this.webbTokenAddresses.get(chainId);
  }

  // public queryAnchors(query: AnchorQuery): Anchor[] {
    
  // }

  public exportConfig(): BridgeConfig {
    return {
      webbTokenAddresses: this.webbTokenAddresses,
      vAnchors: this.vAnchors,
      vBridgeSides: this.vBridgeSides
    };
  }

  public async transact(
    inputs:Utxo[], 
    outputs:Utxo[], 
    fee: BigNumberish, 
    recipient: string,
    relayer: string,
    signer:ethers.Signer
    ) {
    const chainId = await signer.getChainId();
    const signerAddress = await signer.getAddress();
    const vAnchor = this.getVAnchor(chainId);
    if (!vAnchor) {
       throw new Error("VAnchor does not exist on this chain");
    }
    vAnchor.setSigner(signer);

    while (inputs.length !== 2 && inputs.length < 16) {
      inputs.push(new Utxo({chainId: BigNumber.from(await signer.getChainId())}));
    }
    
    //do we have to check if amount is greater than 0 before the checks?????
    //Check that input dest chain is this chain
    for (let i=0; i<inputs.length; i++) {
      if (inputs[i].chainId.toString() !== chainId.toString()) {
        throw new Error("Trying to spend an input with wrong destination chainId");
      }
    }

    //check that output origin chain is this chain
    for (let i=0; i<outputs.length; i++) {
      if (outputs[i].originChainId.toString() !== chainId.toString()) {
        throw new Error("Trying to form an output with the wrong originChainId")
      }
    }
    
    const tokenAddress = await vAnchor.contract.token();

    if (!tokenAddress) {
      throw new Error("Token not supported");
    }

    const tokenInstance = await MintableToken.tokenFromAddress(tokenAddress, signer);

    const extAmount = BigNumber.from(fee)
    .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
    .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))

    const publicAmount = extAmount.sub(fee);
    // console.log(`public amount is ${publicAmount}`);
    // Approve spending if needed
    const userTokenAllowance = await tokenInstance.getAllowance(signerAddress, vAnchor.contract.address);
    if (userTokenAllowance.lt(publicAmount)) {
      await tokenInstance.approveSpending(vAnchor.contract.address);
    }
    //Make Merkle proof
    const merkleProof = inputs.map((x) => this.getVAnchor(Number(x.originChainId))!.getMerkleProof(x));
    //console.log((await tokenInstance.getBalance(signerAddress)).toString());
    await vAnchor.bridgedTransact(inputs, outputs, fee, recipient, relayer, merkleProof);
    //console.log((await tokenInstance.getBalance(signerAddress)).toString());
    await this.updateLinkedVAnchors(vAnchor);
  }

  //token address is address of unwrapped erc20
  public async transactWrap(
    tokenAddress: string,
    inputs:Utxo[], 
    outputs:Utxo[], 
    fee: BigNumberish, 
    recipient: string,
    relayer: string,
    signer:ethers.Signer
    ) {
    
    const chainId = await signer.getChainId();
    const signerAddress = await signer.getAddress();
    const vAnchor = this.getVAnchor(chainId);
    if (!vAnchor) {
       throw new Error("VAnchor does not exist on this chain");
    }
    vAnchor.setSigner(signer);

    while (inputs.length !== 2 && inputs.length < 16) {
      inputs.push(new Utxo({chainId: BigNumber.from(await signer.getChainId())}));
    }
    //console.log(inputs.length);
    //do we have to check if amount is greater than 0 before the checks?????
    //Check that input dest chain is this chain
    for (let i=0; i<inputs.length; i++) {
      if (inputs[i].chainId.toString() !== chainId.toString()) {
        throw new Error("Trying to spend an input with wrong destination chainId");
      }
    }

    //check that output origin chain is this chain
    for (let i=0; i<outputs.length; i++) {
      if (outputs[i].originChainId.toString() !== chainId.toString()) {
        throw new Error("Trying to form an output with the wrong originChainId")
      }
    }

    const tokenInstanceAddress = await vAnchor.contract.token();
    const tokenInstance = await MintableToken.tokenFromAddress(tokenAddress, signer);

    const extAmount = BigNumber.from(fee)
    .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
    .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))

    const publicAmount = extAmount.sub(fee);
    // console.log(`public amount is ${publicAmount}`);
    // Approve spending if needed
    const userTokenAllowance = await tokenInstance.getAllowance(signerAddress, vAnchor.contract.address);
    if (userTokenAllowance.lt(publicAmount)) {
      await tokenInstance.approveSpending(tokenInstanceAddress);
    }

    //Make Merkle proof
    const merkleProof = inputs.map((x) => this.getVAnchor(Number(x.originChainId))!.getMerkleProof(x));
    //console.log((await tokenInstance.getBalance(signerAddress)).toString());
    await vAnchor.bridgedTransactWrap(tokenAddress, inputs, outputs, fee, recipient, relayer, merkleProof);
    //console.log((await tokenInstance.getBalance(signerAddress)).toString());
    await this.updateLinkedVAnchors(vAnchor);
  }
}

export default VBridge;
