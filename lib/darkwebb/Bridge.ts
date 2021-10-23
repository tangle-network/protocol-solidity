import { ethers } from "ethers";
import BridgeSide from './BridgeSide';
import Anchor, { AnchorDeposit } from './Anchor';
import AnchorHandler from "./AnchorHandler";
import MintableToken from "./MintableToken";
import { getHasherFactory, getVerifierFactory } from './utils';
import Verifier from "./Verifier";
import GovernedTokenWrapper from "./GovernedTokenWrapper";

// Deployer config matches the chainId to the signer for that chain
export type DeployerConfig = Record<number, ethers.Signer>;

type AnchorIdentifier = {
  tokenName: string;
  anchorSize: ethers.BigNumberish;
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
  tokenName?: string;
  anchorSize?: ethers.BigNumberish;
  chainId?: number;
  tokenAddress?: string;
}

type TokenIdentifier = {
  tokenName: string;
  chainId: number;
}

export type ExistingAssetInput = {
  // A record of chainId => address
  asset: Record<number, string>;
  anchorSizes: ethers.BigNumberish[];
}

// Users define an input for a completely new bridge
export type BridgeInput = {

  // The tokens and anchors which should be supported after deploying from this bridge input
  anchorInputs: ExistingAssetInput[],

  // The IDs of the chains to deploy to
  chainIDs: number[],
};

export type BridgeConfig = {

  // The addresses of tokens available to be transferred over this bridge config
  // {tokenIdentifier} => tokenAddress
  webbTokenAddresses: Map<string, string>;

  // The addresses of the anchors for a token
  // {anchorIdentifier} => anchorAddress
  anchors: Map<string, Anchor>,

  // The addresses of the Bridge contracts (bridgeSides) to interact with
  bridgeSides: Map<number, BridgeSide>,
}

// A bridge is 
class Bridge {
  private constructor(
    // Mapping of chainId => bridgeSide
    public bridgeSides: Map<number, BridgeSide>,

    // {tokenIdentifier with name prefixed with 'webb'} => webbTokenAddress
    public webbTokenAddresses: Map<string, string>,

    // tokenIdentifier => erc20TokenAddress
    public tokenAddresses: Map<string, string>,

    // Mapping of resourceID => linkedAnchor[]; so we know which
    // anchors need updating when the anchor for resourceID changes state.
    public linkedAnchors: Map<string, Anchor[]>,

    // Mapping of anchorIdString => Anchor for easy anchor access
    public anchors: Map<string, Anchor>,
  ) {}

  public static createAnchorIdString(anchorIdentifier: AnchorIdentifier): string {
    return `${anchorIdentifier.chainId.toString()}-${anchorIdentifier.tokenName}-${anchorIdentifier.anchorSize.toString()}`;
  }

  public static createAnchorIdentifier(anchorString: string): AnchorIdentifier | null {
    const identifyingInfo = anchorString.split('-');
    if (identifyingInfo.length != 3) {
      return null;
    }
    return {
      chainId: Number(identifyingInfo[0]),
      tokenName: identifyingInfo[1],
      anchorSize: identifyingInfo[2],
    }
  }

  public static createTokenIdString(tokenIdentifier: TokenIdentifier): string {
    return `${tokenIdentifier.tokenName}-${tokenIdentifier.chainId}`;
  }

  // Takes as input a 2D array [[anchors to link together], [...]]
  // And returns a map of resourceID => linkedAnchor[]
  public static async createLinkedAnchorMap(createdAnchors: Anchor[][]): Promise<Map<string, Anchor[]>> {
    let linkedAnchorMap = new Map<string, Anchor[]>();
    for (let groupedAnchors of createdAnchors) {
      for (let i=0; i<groupedAnchors.length; i++) {
        // create the resourceID of this anchor
        let resourceID = await groupedAnchors[i].createResourceId();
        let linkedAnchors = [];
        for (let j = 0; j < groupedAnchors.length; j++) {
          if (i != j) {
            linkedAnchors.push(groupedAnchors[j]);
          }
        }

        // insert the linked anchors into the linked map
        linkedAnchorMap.set(resourceID, linkedAnchors);
      }
    }

    return linkedAnchorMap;
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

  public static async deployBridge(bridgeInput: BridgeInput, deployers: DeployerConfig): Promise<Bridge> {
    
    let webbTokenAddresses: Map<string, string> = new Map();
    let tokenAddresses: Map<string, string> = new Map();
    let bridgeSides: Map<number, BridgeSide> = new Map();
    let anchors: Map<string, Anchor> = new Map();
    // createdAnchors have the form of [[Anchors created on chainID], [...]]
    // and anchors in the subArrays of thhe same index should be linked together
    let createdAnchors: Anchor[][] = [];

    for (let chainID of bridgeInput.chainIDs) {
      const adminAddress = await deployers[chainID].getAddress();

      // Create the bridgeSide
      const bridgeInstance = await BridgeSide.createBridgeSide(
        [adminAddress],
        1,
        0,
        100,
        deployers[chainID],
      );

      bridgeSides.set(chainID, bridgeInstance);
      console.log(`bridgeSide address on ${chainID}: ${bridgeInstance.contract.address}`);

      // Create the Hasher and Verifier for the chain
      const hasherFactory = await getHasherFactory(deployers[chainID]);
      let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
      await hasherInstance.deployed();

      const verifier = await Verifier.createVerifier(deployers[chainID]);
      let verifierInstance = verifier.contract;

      // loop through all the tokens defined in the config
      for (let token of bridgeInput.anchorInputs) {
        let originalToken: MintableToken = await MintableToken.tokenFromAddress(token.asset[chainID], deployers[chainID]);
        let tokenInstance: GovernedTokenWrapper = await GovernedTokenWrapper.createGovernedTokenWrapper(
          `webb${originalToken.name}`,
          `webb${originalToken.symbol}`,
          await deployers[chainID].getAddress(),
          '10000000000000000000000000',
          false,
          deployers[chainID],
        );
        const webbTokenName = await tokenInstance.contract.name();

        await tokenInstance.contract.add(originalToken.contract.address);

        console.log(`token address of name: ${webbTokenName} on ${chainID}: ${tokenInstance.contract.address}`);
        // append each token
        webbTokenAddresses.set(
          Bridge.createTokenIdString({tokenName: webbTokenName, chainId: chainID}),
          tokenInstance.contract.address
        );

        tokenAddresses.set(
          Bridge.createTokenIdString({tokenName: originalToken.name, chainId: chainID}),
          originalToken.contract.address
        );
        
        let chainGroupedAnchors: Anchor[] = [];

        // loop through all the anchor sizes on the token
        for (let anchorSize of token.anchorSizes) {
          const anchorInstance = await Anchor.createAnchor(
            verifierInstance.address,
            hasherInstance.address,
            anchorSize,
            30,
            tokenInstance.contract.address,
            adminAddress,
            adminAddress,
            adminAddress,
            bridgeInput.chainIDs.length-1,
            deployers[chainID]
          );

          console.log(`anchor address on ${chainID}: ${anchorInstance.contract.address}`);

          // grant minting rights to the anchor
          await tokenInstance.grantMinterRole(anchorInstance.contract.address); 

          chainGroupedAnchors.push(anchorInstance);
          anchors.set(
            Bridge.createAnchorIdString({tokenName: webbTokenName, anchorSize, chainId: chainID}),
            anchorInstance
          );
          // Also set the original anchor 

        }

        await Bridge.setPermissions(bridgeInstance, chainGroupedAnchors);
        createdAnchors.push(chainGroupedAnchors);
      }
    }

    // All anchors created, massage data to group anchors which should be linked together
    let groupLinkedAnchors: Anchor[][] = [];

    // all subarrays will have the same number of elements
    for(let i=0; i<createdAnchors[0].length; i++) {
      let linkedAnchors: Anchor[] = [];
      for(let j=0; j<createdAnchors.length; j++) {
        linkedAnchors.push(createdAnchors[j][i]);
      }
      groupLinkedAnchors.push(linkedAnchors);
    }

    // finally, link the anchors
    const linkedAnchorMap = await Bridge.createLinkedAnchorMap(groupLinkedAnchors);
    return new Bridge(bridgeSides, webbTokenAddresses, tokenAddresses, linkedAnchorMap, anchors);
  }

  // The setPermissions method accepts initialized bridgeSide and anchors.
  // it creates the anchor handler and sets the appropriate permissions
  // for the bridgeSide/anchorHandler/anchor
  public static async setPermissions(bridgeSide: BridgeSide, anchors: Anchor[]): Promise<void> {

    let resourceIDs: string[] = [];
    let anchorAddresses: string[] = [];
    for (let anchor of anchors) {
      resourceIDs.push(await anchor.createResourceId());
      anchorAddresses.push(anchor.contract.address);
    }

    const handler = await AnchorHandler.createAnchorHandler(bridgeSide.contract.address, resourceIDs, anchorAddresses, bridgeSide.admin);
    await bridgeSide.setAnchorHandler(handler);
    
    for (let anchor of anchors) {
      await bridgeSide.connectAnchor(anchor);
    }
  }

  /** Update the state of BridgeSides and Anchors, when
  *** state changes for the @param linkedAnchor 
  **/
  public async updateLinkedAnchors(linkedAnchor: Anchor) {
    // Find the bridge sides that are connected to this Anchor
    const linkedResourceID = await linkedAnchor.createResourceId();
    const anchorsToUpdate = this.linkedAnchors.get(linkedResourceID);
    if (!anchorsToUpdate) {
      return;
    }

    // update the sides
    for (let anchor of anchorsToUpdate) {
      // get the bridge side which corresponds to this anchor
      const chainId = await anchor.signer.getChainId();
      const bridgeSide = this.bridgeSides.get(chainId);
      await bridgeSide!.voteProposal(linkedAnchor, anchor);
      await bridgeSide!.executeProposal(linkedAnchor, anchor);
    }
  };

  public async update(chainId: number, tokenName: string, anchorSize: ethers.BigNumberish) {
    const anchor = this.getAnchor(chainId, tokenName, anchorSize);
    if (!anchor) {
      return;
    }
    await this.updateLinkedAnchors(anchor);
  }

  public getBridgeSide(chainID: number) {
    return this.bridgeSides.get(chainID);
  }

  public getAnchor(chainID: number, tokenName: string, anchorSize: ethers.BigNumberish) {
    let intendedAnchor: Anchor | undefined = undefined;
    intendedAnchor = this.anchors.get(Bridge.createAnchorIdString({tokenName, anchorSize, chainId: chainID}));

    if (!intendedAnchor) {
      intendedAnchor = this.anchors.get(Bridge.createAnchorIdString({tokenName: `webb${tokenName}`, anchorSize, chainId: chainID}))
    }
    
    return intendedAnchor;
  }

  // Returns the address of the webbToken which wraps the given token name.
  public getWebbTokenAddress(chainID: number, tokenName: string): string | undefined {
    let tokenIdentifier = Bridge.createTokenIdString({ tokenName: `webb${tokenName}`, chainId: chainID });
    return this.webbTokenAddresses.get(tokenIdentifier);
  }

  // public queryAnchors(query: AnchorQuery): Anchor[] {
    
  // }

  // export type BridgeConfig = {

  //   // The addresses of tokens available to be transferred over this bridge config
  //   // {tokenIdentifier} => tokenAddress
  //   webbTokenAddresses: Map<string, string>;
  
  //   // The addresses of the anchors for a token
  //   // {anchorIdentifier} => anchorAddress
  //   anchorAddresses: Map<AnchorIdentifier, string>;
  
  //   // The addresses of the Bridge contracts (bridgeSides) to interact with
  //   bridgeSideAddresses: Map<number, string>;
  // }

  public exportConfig(): BridgeConfig {
    return {
      webbTokenAddresses: this.webbTokenAddresses,
      anchors: this.anchors,
      bridgeSides: this.bridgeSides
    };
  }

  public async deposit(destinationChainId: number, webbTokenName: string, anchorSize: ethers.BigNumberish, signer: ethers.Signer) {
    const chainId = await signer.getChainId();
    const signerAddress = await signer.getAddress();
    const anchor = this.getAnchor(chainId, webbTokenName, anchorSize);
    if (!anchor) {
      throw new Error("Anchor is not supported for the given token and size");
    }

    const tokenAddress = await anchor.contract.token();
    // const tokenAddress = this.webbTokenAddresses.get(Bridge.createTokenIdString({tokenName, chainId}));

    if (!tokenAddress) {
      throw new Error("Token not supported");
    }

    // Check if appropriate balance from user
    const tokenInstance = await MintableToken.tokenFromAddress(tokenAddress, signer);
    const userTokenBalance = await tokenInstance.getBalance(signerAddress);
    console.log('webbTokenInstance address: ', tokenInstance.contract.address);

    if (userTokenBalance.lt(anchorSize)) {
      throw new Error("Not enough balance in webbTokens");
    }

    // Approve spending if needed
    const userTokenAllowance = await tokenInstance.getAllowance(signerAddress, anchor.contract.address);
    if (userTokenAllowance.lt(anchorSize)) {
      await tokenInstance.approveSpending(anchor.contract.address);
    }

    // return some error code value for deposit note if signer invalid
    if (!(await anchor.setSigner(signer))) {
      throw new Error("Invalid signer for deposit, check the signer's chainID");
    }
    const deposit = await anchor.deposit(destinationChainId);
    await this.updateLinkedAnchors(anchor);
    return deposit;
  }

  public async wrapAndDeposit(destinationChainId: number, tokenName: string, anchorSize: ethers.BigNumberish, signer: ethers.Signer) {
    const chainId = await signer.getChainId();
    const signerAddress = await signer.getAddress();
    const anchor = this.getAnchor(chainId, tokenName, anchorSize);
    if (!anchor) {
      throw new Error("Anchor is not supported for the given token and size");
    }

    // get the original erc20 token address
    const originTokenAddress = this.tokenAddresses.get(Bridge.createTokenIdString({tokenName, chainId}));
    if (!originTokenAddress) {
      throw new Error("Origin token not found");
    }

    // Check if appropriate balance from user
    const originTokenInstance = await MintableToken.tokenFromAddress(originTokenAddress, signer);
    const userOriginTokenBalance = await originTokenInstance.getBalance(signerAddress);
    console.log(`originTokenInstance address: ${originTokenAddress} on chain ${chainId}`);

    if (userOriginTokenBalance.lt(anchorSize)) {
      throw new Error("Not enough balance in webbTokens or original ERC20");
    }

    // Continue with deposit flow for wrapAndDeposit:
    // Approve spending if needed
    let userOriginTokenAllowance = await originTokenInstance.getAllowance(signerAddress, anchor.contract.address);
    console.log('original Allowance: ', userOriginTokenAllowance);
    if (userOriginTokenAllowance.lt(anchorSize)) {
      const wrapperTokenAddress = await anchor.contract.token();
      const tx = await originTokenInstance.approveSpending(wrapperTokenAddress);
      await tx.wait();
    }

    // return some error code value for deposit note if signer invalid
    if (!(await anchor.setSigner(signer))) {
      throw new Error("Invalid signer for deposit, check the signer's chainID");
    }

    const deposit = await anchor.wrapAndDeposit(originTokenInstance.contract.address, destinationChainId);
    await this.updateLinkedAnchors(anchor);
    return deposit;
  }

  public async withdraw(
    depositInfo: AnchorDeposit,
    tokenName: string,
    anchorSize: ethers.BigNumberish,
    recipient: string,
    relayer: string,
    signer: ethers.Signer
  ) {
    // Construct the proof from the origin anchor
    const anchorToProve = this.getAnchor(depositInfo.originChainId, tokenName, anchorSize);
    if (!anchorToProve) {
      throw new Error("Could not find anchor to prove against");
    }
    
    const merkleProof = anchorToProve.tree.path(depositInfo.index);

    // Submit the proof and arguments on the destination anchor
    console.log('Before fetching anchor to withdraw: ');
    const anchorToWithdraw = this.getAnchor(Number(depositInfo.deposit.chainID.toString()), tokenName, anchorSize);

    if (!anchorToWithdraw) {
      throw new Error("Could not find anchor to withdraw from");
    }

    if (!(await anchorToWithdraw.setSigner(signer))) {
      throw new Error("Could not set signer");
    }

    const chainId = await signer.getChainId();
    const tokenAddress = this.tokenAddresses.get(Bridge.createTokenIdString({tokenName, chainId}));
    console.log('Token address passed for withdraw: ', tokenAddress);
    await anchorToWithdraw.bridgedWithdraw(depositInfo, merkleProof, recipient, relayer, '0', '0', '0', tokenAddress!);
    return true;
  }

  public async withdrawAndUnwrap(
    depositInfo: AnchorDeposit,
    tokenName: string,
    anchorSize: ethers.BigNumberish,
    recipient: string,
    relayer: string,
    signer: ethers.Signer
  ) {
    
  }
}

export default Bridge;
