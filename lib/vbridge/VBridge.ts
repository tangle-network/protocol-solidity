import { ethers } from "ethers";
import VBridgeSide from './VBridgeSide';
import VAnchor from './VAnchor';
import AnchorHandler from "../bridge/AnchorHandler";
import MintableToken from "../bridge/MintableToken";
import { getHasherFactory } from '../bridge/utils';
import Verifier from "./Verifier";
import GovernedTokenWrapper from "../bridge/GovernedTokenWrapper";

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
};

export type BridgeConfig = {

  // The addresses of tokens available to be transferred over this bridge config
  // chainId => GovernedTokenWrapperAddress
  webbTokenAddresses: Map<number, string>;

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
class VBridge {
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

      vBridgeSides.set(chainID, vBridgeInstance);
      console.log(`vBridgeSide address on ${chainID}: ${vBridgeInstance.contract.address}`);

      // Create the Hasher and Verifier for the chain
      const hasherFactory = await getHasherFactory(deployers[chainID]);
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

      let tokenInstance: GovernedTokenWrapper = await GovernedTokenWrapper.createGovernedTokenWrapper(
        `webbETH-test-1`,
        `webbETH-test-1`,
        await deployers[chainID].getAddress(),
        '10000000000000000000000000',
        allowedNative,
        deployers[chainID],
      );
      
      console.log(`created GovernedTokenWrapper on ${chainID}: ${tokenInstance.contract.address}`);

      // Add all token addresses to the governed token instance.
      for (const tokenToBeWrapped of vBridgeInput.vAnchorInputs.asset[chainID]!) {
        // if the address is not '0', then add it
        if (!checkNativeAddress(tokenToBeWrapped)) {
          const tx = await tokenInstance.contract.add(tokenToBeWrapped);
          const receipt = await tx.wait();
        }
      }

      // append each token
      webbTokenAddresses.set(
        chainID,
        tokenInstance.contract.address
      );
      
      let chainGroupedVAnchors: VAnchor[] = [];

      // loop through all the anchor sizes on the token
      
      const vAnchorInstance = await VAnchor.createVAnchor(
          verifierInstance.address,
          5,
          hasherInstance.address,
          tokenInstance.contract.address,
          {
            bridge: adminAddress,
            admin: adminAddress,
            handler: adminAddress
          },
          vBridgeInput.chainIDs.length-1,
          deployers[chainID]
      );

      console.log(`createdVAnchor: ${vAnchorInstance.contract.address}`);

      // grant minting rights to the anchor
      await tokenInstance.grantMinterRole(vAnchorInstance.contract.address); 

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

    let resourceIDs: string[] = [];
    let vAnchorAddresses: string[] = [];
    for (let vAnchor of vAnchors) {
      resourceIDs.push(await vAnchor.createResourceId());
      vAnchorAddresses.push(vAnchor.contract.address);
    }
           
    const handler = await AnchorHandler.createAnchorHandler(vBridgeSide.contract.address, resourceIDs, vAnchorAddresses, vBridgeSide.admin);
    await vBridgeSide.setAnchorHandler(handler);
    
    for (let vAnchor of vAnchors) {
      await vBridgeSide.connectAnchor(vAnchor);
    }
  }

  /** Update the state of BridgeSides and Anchors, when
  *** state changes for the @param linkedAnchor 
  **/
  public async updateLinkedAnchors(linkedVAnchor: VAnchor) {
    // Find the bridge sides that are connected to this Anchor
    const linkedResourceID = await linkedVAnchor.createResourceId();
    const vAnchorsToUpdate = this.linkedVAnchors.get(linkedResourceID);
    if (!vAnchorsToUpdate) {
      return;
    }

    // update the sides
    for (let vAnchor of vAnchorsToUpdate) {
      // get the bridge side which corresponds to this anchor
      const chainId = await vAnchor.signer.getChainId();
      const vBridgeSide = this.vBridgeSides.get(chainId);
      await vBridgeSide!.voteProposal(linkedVAnchor, vAnchor);
      await vBridgeSide!.executeProposal(linkedVAnchor, vAnchor);
    }
  };

  public async update(chainId: number, anchorSize: ethers.BigNumberish) {
    const anchor = this.getVAnchor(chainId);
    if (!anchor) {
      return;
    }
    await this.updateLinkedAnchors(anchor);
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

  public async transact(destinationChainId:number, signer:ethers.Signer) {
    const chainId = await signer.getChainId();
    const signerAddress = await signer.getAddress();
    const vAnchor = this.getVAnchor(chainId);

    if (!vAnchor) {
       throw new Error("VAnchor does not exist");
    }


  }

  // public async deposit(destinationChainId: number, anchorSize: ethers.BigNumberish, signer: ethers.Signer) {
  //   const chainId = await signer.getChainId();
  //   const signerAddress = await signer.getAddress();
  //   const anchor = this.getAnchor(chainId, anchorSize);
  //   if (!anchor) {
  //     throw new Error("Anchor is not supported for the given token and size");
  //   }

  //   const tokenAddress = await anchor.contract.token();

  //   if (!tokenAddress) {
  //     throw new Error("Token not supported");
  //   }

  //   // Check if appropriate balance from user
  //   const tokenInstance = await MintableToken.tokenFromAddress(tokenAddress, signer);
  //   const userTokenBalance = await tokenInstance.getBalance(signerAddress);

  //   if (userTokenBalance.lt(anchorSize)) {
  //     throw new Error("Not enough balance in webbTokens");
  //   }

  //   // Approve spending if needed
  //   const userTokenAllowance = await tokenInstance.getAllowance(signerAddress, anchor.contract.address);
  //   if (userTokenAllowance.lt(anchorSize)) {
  //     await tokenInstance.approveSpending(anchor.contract.address);
  //   }

  //   // return some error code value for deposit note if signer invalid
  //   if (!(await anchor.setSigner(signer))) {
  //     throw new Error("Invalid signer for deposit, check the signer's chainID");
  //   }
  //   const deposit = await anchor.deposit(destinationChainId);
  //   await this.updateLinkedAnchors(anchor);
  //   return deposit;
  // }

  // public async wrapAndDeposit(destinationChainId: number, tokenAddress: string, anchorSize: ethers.BigNumberish, signer: ethers.Signer) {
  //   const chainId = await signer.getChainId();
  //   const signerAddress = await signer.getAddress();
  //   const anchor = this.getAnchor(chainId, anchorSize);
  //   if (!anchor) {
  //     throw new Error("Anchor is not supported for the given token and size");
  //   }

  //   // Different wrapAndDeposit flows for native vs erc20 tokens
  //   if (checkNativeAddress(tokenAddress)) {
  //     // Check if appropriate balance from user
  //     const nativeBalance = await signer.getBalance();
  //     if (nativeBalance < anchorSize) {
  //       throw new Error("Not enough native token balance")
  //     }

  //     if (!(await anchor.setSigner(signer))) {
  //       throw new Error("Invalid signer for deposit, check the signer's chainID");
  //     }
  //     const deposit = await anchor.wrapAndDeposit(zeroAddress, destinationChainId);
  //     await this.updateLinkedAnchors(anchor);
  //     return deposit;
  //   }
  //   else {
  //     // Check if appropriate balance from user
  //     const originTokenInstance = await MintableToken.tokenFromAddress(tokenAddress, signer);
  //     const userOriginTokenBalance = await originTokenInstance.getBalance(signerAddress);
  //     if (userOriginTokenBalance.lt(anchorSize)) {
  //       throw new Error("Not enough ERC20 balance");
  //     }

  //     // Continue with deposit flow for wrapAndDeposit:
  //     // Approve spending if needed
  //     let userOriginTokenAllowance = await originTokenInstance.getAllowance(signerAddress, anchor.contract.address);
  //     if (userOriginTokenAllowance.lt(anchorSize)) {
  //       const wrapperTokenAddress = await anchor.contract.token();
  //       const tx = await originTokenInstance.approveSpending(wrapperTokenAddress);
  //       await tx.wait();
  //     }

  //     // return some error code value for deposit note if signer invalid
  //     if (!(await anchor.setSigner(signer))) {
  //       throw new Error("Invalid signer for deposit, check the signer's chainID");
  //     }

  //     const deposit = await anchor.wrapAndDeposit(originTokenInstance.contract.address, destinationChainId);
  //     await this.updateLinkedAnchors(anchor);
  //     return deposit;
  //   }
  // }

  // public async withdraw(
  //   depositInfo: AnchorDeposit,
  //   anchorSize: ethers.BigNumberish,
  //   recipient: string,
  //   relayer: string,
  //   signer: ethers.Signer
  // ) {
  //   // Construct the proof from the origin anchor
  //   const anchorToProve = this.getAnchor(depositInfo.originChainId, anchorSize);
  //   if (!anchorToProve) {
  //     throw new Error("Could not find anchor to prove against");
  //   }
    
  //   const merkleProof = anchorToProve.tree.path(depositInfo.index);

  //   // Submit the proof and arguments on the destination anchor
  //   const anchorToWithdraw = this.getAnchor(Number(depositInfo.deposit.chainID.toString()), anchorSize);

  //   if (!anchorToWithdraw) {
  //     throw new Error("Could not find anchor to withdraw from");
  //   }

  //   if (!(await anchorToWithdraw.setSigner(signer))) {
  //     throw new Error("Could not set signer");
  //   }

  //   await anchorToWithdraw.bridgedWithdraw(depositInfo, merkleProof, recipient, relayer, '0', '0', '0');
  //   return true;
  // }

  // public async withdrawAndUnwrap(
  //   depositInfo: AnchorDeposit,
  //   tokenAddress: string,
  //   anchorSize: ethers.BigNumberish,
  //   recipient: string,
  //   relayer: string,
  //   signer: ethers.Signer
  // ) {
  //   // Construct the proof from the origin anchor
  //   const anchorToProve = this.getAnchor(depositInfo.originChainId, anchorSize);
  //   if (!anchorToProve) {
  //     throw new Error("Could not find anchor to prove against");
  //   }

  //   const merkleProof = anchorToProve.tree.path(depositInfo.index);

  //   // Submit the proof and arguments on the destination anchor
  //   const anchorToWithdraw = this.getAnchor(Number(depositInfo.deposit.chainID.toString()), anchorSize);

  //   if (!anchorToWithdraw) {
  //     throw new Error("Could not find anchor to withdraw from");
  //   }

  //   if (!(await anchorToWithdraw.setSigner(signer))) {
  //     throw new Error("Could not set signer");
  //   }

  //   await anchorToWithdraw.bridgedWithdrawAndUnwrap(depositInfo, merkleProof, recipient, relayer, '0', '0', '0', tokenAddress);
  //   return true;
  // }
}

export default VBridge;