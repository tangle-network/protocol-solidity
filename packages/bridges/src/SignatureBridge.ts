import { ethers } from 'ethers';
import { getChainIdType, ZkComponents } from "@webb-tools/utils";
import { PoseidonT3__factory } from "@webb-tools/contracts";
import { MintableToken, GovernedTokenWrapper, Treasury, TreasuryHandler, TokenWrapperHandler } from "@webb-tools/tokens";
import { BridgeInput, DeployerConfig, GovernorConfig, IAnchorDeposit } from "@webb-tools/interfaces";
import { Anchor, AnchorHandler } from '@webb-tools/anchors';
import { SignatureBridgeSide } from './SignatureBridgeSide';
import { Verifier } from "./Verifier";
import { hexToU8a } from '@polkadot/util';

type AnchorIdentifier = {
  anchorSize: ethers.BigNumberish;
  chainId: number;
};

type AnchorQuery = {
  anchorSize?: ethers.BigNumberish;
  chainId?: number;
  tokenAddress?: string;
}

export type SignatureBridgeConfig = {

  // The addresses of tokens available to be transferred over this bridge config
  // chainId => GovernedTokenWrapperAddress
  webbTokenAddresses: Map<number, string>;

  // The addresses of the anchors for the GovernedTokenWrapper
  // {anchorIdentifier} => anchorAddress
  anchors: Map<string, Anchor>,

  // The addresses of the Bridge contracts (bridgeSides) to interact with
  bridgeSides: Map<number, SignatureBridgeSide>,
}

const zeroAddress = "0x0000000000000000000000000000000000000000";

function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}

// A bridge is 
export class SignatureBridge {
  private constructor(
    // Mapping of chainId => bridgeSide
    public bridgeSides: Map<number, SignatureBridgeSide>,

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

  public static async deployFixedDepositBridge(bridgeInput: BridgeInput, deployers: DeployerConfig, initialGovernors: GovernorConfig, zkComponents: ZkComponents): Promise<SignatureBridge> {
    let webbTokenAddresses: Map<number, string> = new Map();
    let bridgeSides: Map<number, SignatureBridgeSide> = new Map();
    let anchors: Map<string, Anchor> = new Map();
    // createdAnchors have the form of [[Anchors created on chainID], [...]]
    // and anchors in the subArrays of thhe same index should be linked together
    let createdAnchors: Anchor[][] = [];

    for (let chainID of bridgeInput.chainIDs) {
      // From the initial governors from the GovernorConfig
      const initialGovernor = initialGovernors[chainID];

      // Create the bridgeSide
      const bridgeInstance = await SignatureBridgeSide.createBridgeSide(
        initialGovernor,
        deployers[chainID],
      );

      const handler = await AnchorHandler.createAnchorHandler(bridgeInstance.contract.address, [],[], bridgeInstance.admin);
      await bridgeInstance.setAnchorHandler(handler);

      bridgeSides.set(chainID, bridgeInstance);

      // Create Treasury and TreasuryHandler
      const treasuryHandler = await TreasuryHandler.createTreasuryHandler(bridgeInstance.contract.address, [],[], bridgeInstance.admin);

      const treasury = await Treasury.createTreasury(treasuryHandler.contract.address, bridgeInstance.admin);

      await bridgeInstance.setTreasuryHandler(treasuryHandler);
      await bridgeInstance.setTreasuryResourceWithSignature(treasury);

      // Create the Hasher and Verifier for the chain
      const hasherFactory = new PoseidonT3__factory(deployers[chainID]);
      let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
      await hasherInstance.deployed();

      const verifier = await Verifier.createVerifier(deployers[chainID]);
      let verifierInstance = verifier.contract;

      // Check the addresses of the asset. If it is zero, deploy a native token wrapper
      let allowedNative: boolean = false;
      for (const tokenToBeWrapped of bridgeInput.anchorInputs.asset[chainID]!) {
        // If passed '0' or zero address, token to be wrapped should support native.
        if (checkNativeAddress(tokenToBeWrapped)) {
          allowedNative = true;
        }
      }
      // Deploy TokenWrapperHandler
      const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeInstance.contract.address, [], [], bridgeInstance.admin);

      let tokenInstance: GovernedTokenWrapper = await GovernedTokenWrapper.createGovernedTokenWrapper(
        `webbETH-test-1`,
        `webbETH-test-1`,
        treasury.contract.address,
        tokenWrapperHandler.contract.address,
        '10000000000000000000000000',
        allowedNative,
        deployers[chainID],
      );

      await bridgeInstance.setTokenWrapperHandler(tokenWrapperHandler);
      await bridgeInstance.setGovernedTokenResourceWithSignature(tokenInstance);

      // Add all token addresses to the governed token instance.
      for (const tokenToBeWrapped of bridgeInput.anchorInputs.asset[chainID]!) {
        // if the address is not '0', then add it
        if (!checkNativeAddress(tokenToBeWrapped)) {
          const tx = await bridgeInstance.executeAddTokenProposalWithSig(tokenInstance, tokenToBeWrapped);
        }
      }

      // append each token
      webbTokenAddresses.set(
        chainID,
        tokenInstance.contract.address
      );
      
      let chainGroupedAnchors: Anchor[] = [];

      //
      // loop through all the anchor sizes on the token
      for (let anchorSize of bridgeInput.anchorInputs.anchorSizes) {
        const anchorInstance = await Anchor.createAnchor(
          verifierInstance.address,
          hasherInstance.address,
          anchorSize,
          30,
          tokenInstance.contract.address,
          // TODO: Replace with anchor handler address
          handler.contract.address,
          bridgeInput.chainIDs.length-1,
          zkComponents,
          deployers[chainID]
        );

        // grant minting rights to the anchor
        await tokenInstance.grantMinterRole(anchorInstance.contract.address); 

        chainGroupedAnchors.push(anchorInstance);
        anchors.set(
          SignatureBridge.createAnchorIdString({anchorSize, chainId: chainID}),
          anchorInstance
        );
      }
      await SignatureBridge.setPermissions(bridgeInstance, chainGroupedAnchors);
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
    const linkedAnchorMap = await SignatureBridge.createLinkedAnchorMap(groupLinkedAnchors);
    return new SignatureBridge(bridgeSides, webbTokenAddresses, linkedAnchorMap, anchors);
  }

  // The setPermissions method accepts initialized bridgeSide and anchors.
  // it creates the anchor handler and sets the appropriate permissions
  // for the bridgeSide/AnchorHandler/anchor
  public static async setPermissions(bridgeSide: SignatureBridgeSide, anchors: Anchor[]): Promise<void> {
    for (let anchor of anchors) {
      await bridgeSide.setResourceWithSignature(anchor);
    }
    
    for (let anchor of anchors) {
      await bridgeSide.connectAnchorWithSignature(anchor);
    }
  }

 /**
  * Updates the state of the SignatureBridgeSides and Anchors with
  * the new state of the @param srcAnchor.
  * @param srcAnchor The anchor that has updated.
  * @returns 
  */
  public async updateLinkedAnchors(srcAnchor: Anchor) {
    // Find the bridge sides that are connected to this Anchor
    const linkedResourceID = await srcAnchor.createResourceId();
    const anchorsToUpdate = this.linkedAnchors.get(linkedResourceID);
    if (!anchorsToUpdate) {
      return;
    }

    // update the sides
    for (let anchor of anchorsToUpdate) {
      // get the bridge side which corresponds to this anchor
      const resourceID = await anchor.createResourceId();
      const chainId = getChainIdType(await anchor.signer.getChainId());
      const bridgeSide = this.bridgeSides.get(chainId);
      await bridgeSide!.executeAnchorProposalWithSig(srcAnchor, resourceID);
    }
  };

  // This update method is called when anchor deposits have been made outside of these wrappers.
  public async update(chainId: number, anchorSize: ethers.BigNumberish) {
    const anchor = this.getAnchor(chainId, anchorSize);
    await anchor.update();
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
    intendedAnchor = this.anchors.get(SignatureBridge.createAnchorIdString({anchorSize, chainId}));
    return intendedAnchor;
  }

  // Returns the address of the webbToken which wraps the given token name.
  public getWebbTokenAddress(chainId: number): string | undefined {
    return this.webbTokenAddresses.get(chainId);
  }

  public exportConfig(): SignatureBridgeConfig {
    return {
      webbTokenAddresses: this.webbTokenAddresses,
      anchors: this.anchors,
      bridgeSides: this.bridgeSides
    };
  }

  public async deposit(destinationChainId: number, anchorSize: ethers.BigNumberish, signer: ethers.Signer) {
    const chainId = getChainIdType(await signer.getChainId());
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
    const deposit = await anchor.deposit(destinationChainId);
    await this.updateLinkedAnchors(anchor);
    return deposit;
  }

  public async wrapAndDeposit(destinationChainId: number, tokenAddress: string, anchorSize: ethers.BigNumberish, wrappingFee: number = 0, signer: ethers.Signer) {
    const chainId = getChainIdType(await signer.getChainId());
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
      const deposit = await anchor.wrapAndDeposit(zeroAddress, wrappingFee, destinationChainId);
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
        const tx = await originTokenInstance.approveSpending(wrapperTokenAddress);
        await tx.wait();
      }

      // return some error code value for deposit note if signer invalid
      if (!(await anchor.setSigner(signer))) {
        throw new Error("Invalid signer for deposit, check the signer's chainID");
      }

      const deposit = await anchor.wrapAndDeposit(originTokenInstance.contract.address, wrappingFee, destinationChainId);
      await this.updateLinkedAnchors(anchor);
      return deposit;
    }
  }

  public async withdraw(
    depositInfo: IAnchorDeposit,
    anchorSize: ethers.BigNumberish,
    recipient: string,
    relayer: string,
    signer: ethers.Signer
  ) {
    // Construct the proof from the origin anchor
    const anchorToProve = this.getAnchor(depositInfo.originChainId, anchorSize);
    if (!anchorToProve) {
      throw new Error("Could not find anchor to prove against");
    }

    const leaves = anchorToProve.tree.elements();

    // Submit the proof and arguments on the destination anchor
    const anchorToWithdraw = this.getAnchor(Number(depositInfo.deposit.chainID.toString()), anchorSize);

    if (!anchorToWithdraw) {
      throw new Error("Could not find anchor to withdraw from");
    }

    if (!(await anchorToWithdraw.setSigner(signer))) {
      throw new Error("Could not set signer");
    }
    await anchorToWithdraw.bridgedWithdraw(depositInfo, leaves, recipient, relayer, '0', '0', '0');
    return true;
  }

  public async withdrawAndUnwrap(
    depositInfo: IAnchorDeposit,
    tokenAddress: string,
    anchorSize: ethers.BigNumberish,
    recipient: string,
    relayer: string,
    signer: ethers.Signer
  ) {
    // Construct the proof from the origin anchor
    const anchorToProve = this.getAnchor(depositInfo.originChainId, anchorSize);
    if (!anchorToProve) {
      throw new Error("Could not find anchor to prove against");
    }

    //TODO: if the signer has the same chain ID as the origin, do a same-side withdraw

    const leaves = anchorToProve.tree.elements();

    // Submit the proof and arguments on the destination anchor
    const anchorToWithdraw = this.getAnchor(Number(depositInfo.deposit.chainID.toString()), anchorSize);

    if (!anchorToWithdraw) {
      throw new Error("Could not find anchor to withdraw from");
    }

    if (!(await anchorToWithdraw.setSigner(signer))) {
      throw new Error("Could not set signer");
    }

    await anchorToWithdraw.bridgedWithdrawAndUnwrap(depositInfo, leaves, recipient, relayer, '0', '0', '0', tokenAddress);
    return true;
  }
}