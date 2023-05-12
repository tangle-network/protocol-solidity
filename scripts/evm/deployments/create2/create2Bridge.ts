import { AnchorHandler, PoseidonHasher, VAnchor, Verifier } from '@webb-tools/anchors';
import { DeterministicDeployFactory__factory } from '@webb-tools/contracts';
import { Deployer } from '@webb-tools/create2-utils';
import { DeployerConfig, GovernorConfig } from '@webb-tools/interfaces';
import {
  FungibleTokenWrapper,
  TokenWrapperHandler,
  Treasury,
  TreasuryHandler,
} from '@webb-tools/tokens';
import { ZkComponents, getChainIdType } from '@webb-tools/utils';
import { SignatureBridgeSide } from '@webb-tools/vbridge';
import { BaseContract, BigNumber, ethers } from 'ethers';

export type ExistingAssetInput = {
  // A record of chainId => address of wrappable tokens to be supported in the webbToken.
  asset: Record<number, string[]>;
};

// Users define an input for a completely new bridge
export type VBridgeInput = {
  // The tokens which should be supported after deploying from this bridge input
  vAnchorInputs: ExistingAssetInput;

  // The IDs of the chains to deploy to
  chainIDs: number[];

  // The number of max edges for vanchors, if not provided, maxEdges is derived from passed chainIDs.
  maxEdges?: number;

  // Existing webb tokens can be connected
  webbTokens: Map<number, FungibleTokenWrapper | undefined>;
};

export type BridgeConfig = {
  // The addresses of tokens available to be transferred over this bridge config
  // chainId => FungibleTokenWrapperAddress
  webbTokenAddresses: Map<number, string | undefined>;

  // The addresses of the anchors for the FungibleTokenWrapper
  // {anchorIdentifier} => anchorAddress
  vAnchors: Map<string, VAnchor>;

  // The addresses of the Bridge contracts (bridgeSides) to interact with
  vBridgeSides: Map<number, SignatureBridgeSide<BaseContract>>;
};

const zeroAddress = '0x0000000000000000000000000000000000000000';

function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}

// A bridge is
export class Create2VBridge {
  private constructor(
    // Mapping of chainId => vBridgeSide
    public vBridgeSides: Map<number, SignatureBridgeSide<BaseContract>>,

    // chainID => FungibleTokenWrapper (webbToken) address
    public webbTokenAddresses: Map<number, string>,

    // Mapping of resourceID => linkedVAnchor[]; so we know which
    // vanchors need updating when the anchor for resourceID changes state.
    public linkedVAnchors: Map<string, VAnchor[]>,

    // Mapping of anchorIdString => Anchor for easy anchor access
    public vAnchors: Map<string, VAnchor>
  ) {}

  //might need some editing depending on whether anchor identifier structure changes
  public static createVAnchorIdString(chainId: number): string {
    return chainId.toString();
  }

  // Takes as input a 2D array [[anchors to link together], [...]]
  // And returns a map of resourceID => linkedAnchor[]
  public static async createLinkedVAnchorMap(
    createdVAnchors: VAnchor[][]
  ): Promise<Map<string, VAnchor[]>> {
    let linkedVAnchorMap = new Map<string, VAnchor[]>();
    for (let groupedVAnchors of createdVAnchors) {
      for (let i = 0; i < groupedVAnchors.length; i++) {
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

  // Deployments of all contracts for the bridge will be done with the DeployerConfig.
  // After deployments, the wallet in the DeployerConfig will transfer ownership
  // to the initialGovernor
  public static async deployVariableAnchorBridge(
    vBridgeInput: VBridgeInput,
    deployers: DeployerConfig,
    initialGovernors: GovernorConfig,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents
  ): Promise<Create2VBridge> {
    const salt = '999';
    const saltHex = ethers.utils.id(salt);
    let webbTokenAddresses: Map<number, string> = new Map();
    let vBridgeSides: Map<number, SignatureBridgeSide<BaseContract>> = new Map();
    let vAnchors: Map<string, VAnchor> = new Map();
    // createdAnchors have the form of [[Anchors created on chainID], [...]]
    // and anchors in the subArrays of thhe same index should be linked together
    let createdVAnchors: VAnchor[][] = [];

    // Determine the maxEdges for the anchors on this VBridge deployment
    let maxEdges = vBridgeInput.maxEdges ?? vBridgeInput.chainIDs.length > 2 ? 7 : 1;

    for (let chainID of vBridgeInput.chainIDs) {
      const initialGovernor = initialGovernors[chainID];
      // Create the bridgeSide
      let deployer: Deployer;
      const Deployer1 = new DeterministicDeployFactory__factory(deployers[chainID]);
      let deployer1Contract = await Deployer1.deploy();
      await deployer1Contract.deployed();
      deployer = new Deployer(deployer1Contract);
      console.log('deployer address : ', deployer.address);
      let vBridgeInstance = await SignatureBridgeSide.create2BridgeSide(
        deployer,
        saltHex,
        deployers[chainID]
      );
      const handler = await AnchorHandler.create2AnchorHandler(
        vBridgeInstance.contract.address,
        [],
        [],
        deployer,
        saltHex,
        deployers[chainID]
      );
      vBridgeInstance.setAnchorHandler(handler);
      // Create Treasury and TreasuryHandler
      const treasuryHandler = await TreasuryHandler.create2TreasuryHandler(
        vBridgeInstance.contract.address,
        [],
        [],
        deployer,
        saltHex,
        vBridgeInstance.admin
      );
      const treasury = await Treasury.create2Treasury(
        treasuryHandler.contract.address,
        deployer,
        saltHex,
        vBridgeInstance.admin
      );
      await vBridgeInstance.setTreasuryHandler(treasuryHandler);
      await vBridgeInstance.setTreasuryResourceWithSignature(treasury);
      // Create the Hasher and Verifier for the chain
      const hasherInstance = await PoseidonHasher.create2PoseidonHasher(
        deployer,
        saltHex,
        deployers[chainID]
      );
      const verifier = await Verifier.create2Verifier(deployer, saltHex, deployers[chainID]);
      let verifierInstance = verifier.contract;
      // Check the addresses of the asset. If it is zero, deploy a native token wrapper
      let allowedNative: boolean = false;
      for (const tokenToBeWrapped of vBridgeInput.vAnchorInputs.asset[chainID]!) {
        // If passed '0' or zero address, token to be wrapped should support native.
        if (checkNativeAddress(tokenToBeWrapped)) {
          allowedNative = true;
        }
      }

      // Deploy TokenWrapperHandler
      const tokenWrapperHandler = await TokenWrapperHandler.create2TokenWrapperHandler(
        vBridgeInstance.contract.address,
        [],
        [],
        deployer,
        saltHex,
        vBridgeInstance.admin
      );
      let tokenInstance: FungibleTokenWrapper;
      if (!vBridgeInput.webbTokens.get(chainID)) {
        tokenInstance = await FungibleTokenWrapper.create2FungibleTokenWrapper(
          `webbWETH`,
          `webbWETH`,
          0,
          treasury.contract.address,
          tokenWrapperHandler.contract.address,
          '10000000000000000000000000',
          allowedNative,
          deployer,
          saltHex,
          deployers[chainID]
        );
      } else {
        tokenInstance = vBridgeInput.webbTokens.get(chainID)!;
      }
      await vBridgeInstance.setTokenWrapperHandler(tokenWrapperHandler);
      await vBridgeInstance.setFungibleTokenResourceWithSignature(tokenInstance);
      // Add all token addresses to the governed token instance.
      for (const tokenToBeWrapped of vBridgeInput.vAnchorInputs.asset[chainID]!) {
        // if the address is not '0', then add it
        if (!checkNativeAddress(tokenToBeWrapped)) {
          await vBridgeInstance.executeAddTokenProposalWithSig(tokenInstance, tokenToBeWrapped);
        }
      }
      // append each token
      webbTokenAddresses.set(chainID, tokenInstance.contract.address);

      let chainGroupedVAnchors: VAnchor[] = [];

      // loop through all the anchor sizes on the token
      const vAnchorInstance = await VAnchor.create2VAnchor(
        deployer,
        saltHex,
        verifierInstance.address,
        30,
        hasherInstance.contract.address,
        handler.contract.address,
        tokenInstance.contract.address,
        maxEdges,
        smallCircuitZkComponents,
        largeCircuitZkComponents,
        deployers[chainID]
      );

      // initialize vanchor contract instance
      let tokenDenomination = '1000000000000000000'; // 1 ether
      await vAnchorInstance.contract.initialize(
        BigNumber.from(0).toString(), //minimum withdrawal limit
        BigNumber.from(tokenDenomination).mul(1_000_000).toString() // max deposit limit
      );

      // grant minting rights to the anchor
      await tokenInstance.grantMinterRole(vAnchorInstance.contract.address);
      chainGroupedVAnchors.push(vAnchorInstance);
      vAnchors.set(Create2VBridge.createVAnchorIdString(chainID), vAnchorInstance);

      // connect bridge, anchor and anchor handler set permissions
      await vBridgeInstance.connectAnchorWithSignature(vAnchorInstance);
      createdVAnchors.push(chainGroupedVAnchors);

      const governorAddress =
        typeof initialGovernor === 'string' ? initialGovernor : initialGovernor.address;
      const governorNonce = typeof initialGovernor === 'string' ? 0 : initialGovernor.nonce;

      // Transfer ownership of the bridge to the initialGovernor
      const tx = await vBridgeInstance.transferOwnership(governorAddress, governorNonce);
      await tx.wait();
      vBridgeSides.set(chainID, vBridgeInstance);
    }

    // All anchors created, massage data to group anchors which should be linked together
    let groupLinkedVAnchors: VAnchor[][] = [];

    // all subarrays will have the same number of elements
    for (let i = 0; i < createdVAnchors[0].length; i++) {
      let linkedAnchors: VAnchor[] = [];
      for (let j = 0; j < createdVAnchors.length; j++) {
        linkedAnchors.push(createdVAnchors[j][i]);
      }
      groupLinkedVAnchors.push(linkedAnchors);
    }

    // link the anchors
    const linkedVAnchorMap = await Create2VBridge.createLinkedVAnchorMap(groupLinkedVAnchors);

    return new Create2VBridge(vBridgeSides, webbTokenAddresses, linkedVAnchorMap, vAnchors);
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
      const chainId = getChainIdType(await vAnchor.signer.getChainId());
      const resourceID = await vAnchor.createResourceId();
      const vBridgeSide = this.vBridgeSides.get(chainId);
      await vBridgeSide!.executeAnchorProposalWithSig(srcAnchor, resourceID);
    }
  }

  public async update(chainId: number) {
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
    let intendedAnchor: VAnchor = undefined;
    intendedAnchor = this.vAnchors.get(Create2VBridge.createVAnchorIdString(chainId));
    return intendedAnchor;
  }

  // Returns the address of the webbToken which wraps the given token name.
  public getWebbTokenAddress(chainId: number): string | undefined {
    return this.webbTokenAddresses.get(chainId);
  }

  public exportConfig(): BridgeConfig {
    return {
      webbTokenAddresses: this.webbTokenAddresses,
      vAnchors: this.vAnchors,
      vBridgeSides: this.vBridgeSides,
    };
  }
}

export default Create2VBridge;