import { ethers } from "ethers";
import { BridgeSide } from './BridgeSide';
import { Anchor } from './Anchor';
import { AnchorHandler } from "./AnchorHandler";
import { MintableToken, GovernedTokenWrapper } from "@webb-tools/tokens";
import { AnchorDeposit } from './types';
import { Verifier } from "./Verifier";
import { Overrides, ZkComponents } from "@webb-tools/utils";
import { PoseidonT3__factory } from "@webb-tools/contracts";

// Deployer config matches the chainId to the signer for that chain
export type DeployerConfig = {
  wallets: Record<number, ethers.Signer>;
  gasLimits?: Record<number, ethers.BigNumberish>;
};

type AnchorIdentifier = {
  anchorSize: ethers.BigNumberish;
  chainId: number;
};

type AnchorQuery = {
  anchorSize?: ethers.BigNumberish;
  chainId?: number;
  tokenAddress?: string;
}

export type ExistingAssetInput = {
  // A record of chainId => address
  asset: Record<number, string[]>;
  anchorSizes: ethers.BigNumberish[];
}

// Users define an input for a completely new bridge
export type BridgeInput = {

  // The tokens and anchors which should be supported after deploying from this bridge input
  anchorInputs: ExistingAssetInput,

  // The IDs of the chains to deploy to
  chainIDs: number[],
};

export type BridgeConfig = {

  // The addresses of tokens available to be transferred over this bridge config
  // chainId => GovernedTokenWrapperAddress
  webbTokenAddresses: Map<number, string>;

  // The addresses of the anchors for the GovernedTokenWrapper
  // {anchorIdentifier} => anchorAddress
  anchors: Map<string, Anchor>,

  // The addresses of the Bridge contracts (bridgeSides) to interact with
  bridgeSides: Map<number, BridgeSide>,
}

const zeroAddress = "0x0000000000000000000000000000000000000000";

function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}

// A bridge is 
export class Bridge {
  private constructor(
    // Mapping of chainId => bridgeSide
    public bridgeSides: Map<number, BridgeSide>,

    // chainID => GovernedTokenWrapper (webbToken) address
    public webbTokenAddresses: Map<number, string>,

    // Mapping of resourceID => linkedAnchor[]; so we know which
    // anchors need updating when the anchor for resourceID changes state.
    public linkedAnchors: Map<string, Anchor[]>,

    // Mapping of anchorIdString => Anchor for easy anchor access
    public anchors: Map<string, Anchor>,
  ) {}

  public static createAnchorIdString(anchorIdentifier: AnchorIdentifier): string {
    return `${anchorIdentifier.chainId.toString()}-${anchorIdentifier.anchorSize.toString()}`;
  }

  public static createAnchorIdentifier(anchorString: string): AnchorIdentifier | null {
    const identifyingInfo = anchorString.split('-');
    if (identifyingInfo.length != 2) {
      return null;
    }
    return {
      chainId: Number(identifyingInfo[0]),
      anchorSize: identifyingInfo[1],
    }
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

  public static async deployBridge(bridgeInput: BridgeInput, deployers: DeployerConfig, zkComponents: ZkComponents): Promise<Bridge> {
    
    let webbTokenAddresses: Map<number, string> = new Map();
    let bridgeSides: Map<number, BridgeSide> = new Map();
    let anchors: Map<string, Anchor> = new Map();
    // createdAnchors have the form of [[Anchors created on chainID], [...]]
    // and anchors in the subArrays of thhe same index should be linked together
    let createdAnchors: Anchor[][] = [];

    for (let chainID of bridgeInput.chainIDs) {
      const adminAddress = await deployers.wallets[chainID].getAddress();

      // Create the bridgeSide
      const bridgeInstance = await BridgeSide.createBridgeSide(
        [adminAddress],
        1,
        0,
        100,
        deployers.wallets[chainID],
        { gasLimit: deployers.gasLimits[chainID] }
      );

      bridgeSides.set(chainID, bridgeInstance);
      console.log(`bridgeSide address on ${chainID}: ${bridgeInstance.contract.address}`);

      // Create the Hasher and Verifier for the chain
      const hasherFactory = new PoseidonT3__factory(deployers.wallets[chainID]);
      let hasherInstance = await hasherFactory.deploy({ gasLimit: deployers.gasLimits[chainID] });
      await hasherInstance.deployed();

      const verifier = await Verifier.createVerifier(deployers.wallets[chainID], { gasLimit: deployers.gasLimits[chainID] });
      let verifierInstance = verifier.contract;

      // Check the addresses of the asset. If it is zero, deploy a native token wrapper
      let allowedNative: boolean = false;
      for (const tokenToBeWrapped of bridgeInput.anchorInputs.asset[chainID]!) {
        // If passed '0' or zero address, token to be wrapped should support native.
        if (checkNativeAddress(tokenToBeWrapped)) {
          allowedNative = true;
        }
      }

      let tokenInstance: GovernedTokenWrapper = await GovernedTokenWrapper.createGovernedTokenWrapper(
        `webbETH-test-1`,
        `webbETH-test-1`,
        await deployers.wallets[chainID].getAddress(),
        '10000000000000000000000000',
        allowedNative,
        deployers.wallets[chainID],
        { gasLimit: deployers.gasLimits[chainID] }
      );
      
      console.log(`created GovernedTokenWrapper on ${chainID}: ${tokenInstance.contract.address}`);

      // Add all token addresses to the governed token instance.
      for (const tokenToBeWrapped of bridgeInput.anchorInputs.asset[chainID]!) {
        // if the address is not '0', then add it
        if (!checkNativeAddress(tokenToBeWrapped)) {
          const tx = await tokenInstance.contract.add(tokenToBeWrapped, { gasLimit: deployers.gasLimits[chainID] });
          const receipt = await tx.wait();
        }
      }

      // append each token
      webbTokenAddresses.set(
        chainID,
        tokenInstance.contract.address
      );
      
      let chainGroupedAnchors: Anchor[] = [];

      // loop through all the anchor sizes on the token
      for (let anchorSize of bridgeInput.anchorInputs.anchorSizes) {
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
          zkComponents,
          deployers.wallets[chainID],
          { gasLimit: deployers.gasLimits[chainID] }
        );

        console.log(`createdAnchor: ${anchorInstance.contract.address}`);

        // grant minting rights to the anchor
        const tx = await tokenInstance.grantMinterRole(anchorInstance.contract.address, { gasLimit: deployers.gasLimits[chainID] }); 
        await tx.wait();

        chainGroupedAnchors.push(anchorInstance);
        anchors.set(
          Bridge.createAnchorIdString({anchorSize, chainId: chainID}),
          anchorInstance
        );
      }

      await Bridge.setPermissions(bridgeInstance, chainGroupedAnchors, { gasLimit: deployers.gasLimits[chainID] });
      createdAnchors.push(chainGroupedAnchors);
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
    return new Bridge(bridgeSides, webbTokenAddresses, linkedAnchorMap, anchors);
  }

  // The setPermissions method accepts initialized bridgeSide and anchors.
  // it creates the anchor handler and sets the appropriate permissions
  // for the bridgeSide/anchorHandler/anchor
  public static async setPermissions(bridgeSide: BridgeSide, anchors: Anchor[], overrides?: Overrides): Promise<void> {

    let resourceIDs: string[] = [];
    let anchorAddresses: string[] = [];
    for (let anchor of anchors) {
      resourceIDs.push(await anchor.createResourceId());
      anchorAddresses.push(anchor.contract.address);
    }

    const handler = await AnchorHandler.createAnchorHandler(bridgeSide.contract.address, resourceIDs, anchorAddresses, bridgeSide.admin, overrides);
    await bridgeSide.setAnchorHandler(handler);
    
    for (let anchor of anchors) {
      await bridgeSide.connectAnchor(anchor, overrides);
    }
  }

  /** Update the state of BridgeSides and Anchors, when
  *** state changes for the @param linkedAnchor 
  **/
  public async updateLinkedAnchors(linkedAnchor: Anchor, overrides?: Overrides) {
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
      await bridgeSide!.voteProposal(linkedAnchor, anchor, overrides);
      await bridgeSide!.executeProposal(linkedAnchor, anchor, overrides);
    }
  };

  public async update(chainId: number, anchorSize: ethers.BigNumberish) {
    const anchor = this.getAnchor(chainId, anchorSize);
    if (!anchor) {
      return;
    }
    await this.updateLinkedAnchors(anchor);
  }

  public getBridgeSide(chainId: number) {
    return this.bridgeSides.get(chainId);
  }

  public getAnchor(chainId: number, anchorSize: ethers.BigNumberish) {
    let intendedAnchor: Anchor | undefined = undefined;
    intendedAnchor = this.anchors.get(Bridge.createAnchorIdString({anchorSize, chainId}));
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
      anchors: this.anchors,
      bridgeSides: this.bridgeSides
    };
  }

  public async deposit(destinationChainId: number, anchorSize: ethers.BigNumberish, signer: ethers.Signer, overrides?: Overrides) {
    const chainId = await signer.getChainId();
    const signerAddress = await signer.getAddress();
    const anchor = this.getAnchor(chainId, anchorSize);
    if (!anchor) {
      throw new Error("Anchor is not supported for the given token and size");
    }

    const tokenAddress = await anchor.contract.token();

    if (!tokenAddress) {
      throw new Error("Token not supported");
    }

    // Check if appropriate balance from user
    const tokenInstance = await MintableToken.tokenFromAddress(tokenAddress, signer);
    const userTokenBalance = await tokenInstance.getBalance(signerAddress);

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
    const deposit = await anchor.deposit(destinationChainId, overrides);
    await this.updateLinkedAnchors(anchor);
    return deposit;
  }

  public async wrapAndDeposit(destinationChainId: number, tokenAddress: string, anchorSize: ethers.BigNumberish, signer: ethers.Signer, overrides?: Overrides) {
    const chainId = await signer.getChainId();
    const signerAddress = await signer.getAddress();
    const anchor = this.getAnchor(chainId, anchorSize);
    if (!anchor) {
      throw new Error("Anchor is not supported for the given token and size");
    }

    // Different wrapAndDeposit flows for native vs erc20 tokens
    if (checkNativeAddress(tokenAddress)) {
      // Check if appropriate balance from user
      const nativeBalance = await signer.getBalance();
      if (nativeBalance < anchorSize) {
        throw new Error("Not enough native token balance")
      }

      if (!(await anchor.setSigner(signer))) {
        throw new Error("Invalid signer for deposit, check the signer's chainID");
      }
      const deposit = await anchor.wrapAndDeposit(zeroAddress, destinationChainId, overrides);
      await this.updateLinkedAnchors(anchor);
      return deposit;
    }
    else {
      // Check if appropriate balance from user
      const originTokenInstance = await MintableToken.tokenFromAddress(tokenAddress, signer);
      const userOriginTokenBalance = await originTokenInstance.getBalance(signerAddress);
      if (userOriginTokenBalance.lt(anchorSize)) {
        throw new Error("Not enough ERC20 balance");
      }

      // Continue with deposit flow for wrapAndDeposit:
      // Approve spending if needed
      let userOriginTokenAllowance = await originTokenInstance.getAllowance(signerAddress, anchor.contract.address);
      if (userOriginTokenAllowance.lt(anchorSize)) {
        const wrapperTokenAddress = await anchor.contract.token();
        const tx = await originTokenInstance.approveSpending(wrapperTokenAddress, overrides);
        await tx.wait();
      }

      // return some error code value for deposit note if signer invalid
      if (!(await anchor.setSigner(signer))) {
        throw new Error("Invalid signer for deposit, check the signer's chainID");
      }

      const deposit = await anchor.wrapAndDeposit(originTokenInstance.contract.address, destinationChainId, overrides);
      await this.updateLinkedAnchors(anchor);
      return deposit;
    }
  }

  public async withdraw(
    depositInfo: AnchorDeposit,
    anchorSize: ethers.BigNumberish,
    recipient: string,
    relayer: string,
    signer: ethers.Signer,
    overrides?: Overrides,
  ) {
    // Construct the proof from the origin anchor
    const anchorToProve = this.getAnchor(depositInfo.originChainId, anchorSize);
    if (!anchorToProve) {
      throw new Error("Could not find anchor to prove against");
    }
    
    const merkleProof = anchorToProve.tree.path(depositInfo.index);

    // Submit the proof and arguments on the destination anchor
    const anchorToWithdraw = this.getAnchor(Number(depositInfo.deposit.chainID.toString()), anchorSize);

    if (!anchorToWithdraw) {
      throw new Error("Could not find anchor to withdraw from");
    }

    if (!(await anchorToWithdraw.setSigner(signer))) {
      throw new Error("Could not set signer");
    }

    await anchorToWithdraw.bridgedWithdraw(depositInfo, merkleProof, recipient, relayer, '0', '0', '0', overrides);
    return true;
  }

  public async withdrawAndUnwrap(
    depositInfo: AnchorDeposit,
    tokenAddress: string,
    anchorSize: ethers.BigNumberish,
    recipient: string,
    relayer: string,
    signer: ethers.Signer,
    overrides?: Overrides,
  ) {
    // Construct the proof from the origin anchor
    const anchorToProve = this.getAnchor(depositInfo.originChainId, anchorSize);
    if (!anchorToProve) {
      throw new Error("Could not find anchor to prove against");
    }

    const merkleProof = anchorToProve.tree.path(depositInfo.index);

    // Submit the proof and arguments on the destination anchor
    const anchorToWithdraw = this.getAnchor(Number(depositInfo.deposit.chainID.toString()), anchorSize);

    if (!anchorToWithdraw) {
      throw new Error("Could not find anchor to withdraw from");
    }

    if (!(await anchorToWithdraw.setSigner(signer))) {
      throw new Error("Could not set signer");
    }

    await anchorToWithdraw.bridgedWithdrawAndUnwrap(depositInfo, merkleProof, recipient, relayer, '0', '0', '0', tokenAddress, overrides);
    return true;
  }
}
