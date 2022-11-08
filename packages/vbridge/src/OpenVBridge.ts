import { ethers, BigNumber, BigNumberish } from 'ethers';
import { SignatureBridgeSide } from '@webb-tools/bridges';
import {
  MintableToken,
  GovernedTokenWrapper,
  TreasuryHandler,
  Treasury,
  TokenWrapperHandler,
} from '@webb-tools/tokens';
import { PoseidonT3__factory } from '@webb-tools/contracts';
import Verifier from './Verifier';
import { AnchorIdentifier, GovernorConfig, DeployerConfig } from '@webb-tools/interfaces';
import { AnchorHandler, OpenVAnchor as VAnchor } from '@webb-tools/anchors';
import { hexToU8a, u8aToHex, getChainIdType, ZkComponents } from '@webb-tools/utils';
import { CircomUtxo, Utxo } from '@webb-tools/sdk-core';
import { KeccakHasher__factory } from '@webb-tools/contracts';

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
  webbTokens: Map<number, GovernedTokenWrapper | undefined>;
};

export type BridgeConfig = {
  // The addresses of tokens available to be transferred over this bridge config
  // chainId => GovernedTokenWrapperAddress
  webbTokenAddresses: Map<number, string | undefined>;

  // The addresses of the anchors for the GovernedTokenWrapper
  // {anchorIdentifier} => anchorAddress
  vAnchors: Map<string, VAnchor>;

  // The addresses of the Bridge contracts (bridgeSides) to interact with
  vBridgeSides: Map<number, SignatureBridgeSide>;
};

const zeroAddress = '0x0000000000000000000000000000000000000000';

function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}

// A bridge is
export class OpenVBridge {
  private constructor(
    // Mapping of chainId => vBridgeSide
    public vBridgeSides: Map<number, SignatureBridgeSide>,

    // chainID => GovernedTokenWrapper (webbToken) address
    public webbTokenAddresses: Map<number, string>,

    // Mapping of resourceID => linkedVAnchor[]; so we know which
    // vanchors need updating when the anchor for resourceID changes state.
    public linkedVAnchors: Map<string, VAnchor[]>,

    // Mapping of anchorIdString => Anchor for easy anchor access
    public vAnchors: Map<string, VAnchor>
  ) {}

  //might need some editing depending on whether anchor identifier structure changes
  public static createVAnchorIdString(vAnchorIdentifier: AnchorIdentifier): string {
    return `${vAnchorIdentifier.chainId.toString()}`;
  }

  public static createVAnchorIdentifier(vAnchorString: string): AnchorIdentifier | null {
    return {
      chainId: Number(vAnchorString),
    };
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
    initialGovernors: GovernorConfig
  ): Promise<OpenVBridge> {
    let webbTokenAddresses: Map<number, string> = new Map();
    let vBridgeSides: Map<number, SignatureBridgeSide> = new Map();
    let vAnchors: Map<string, VAnchor> = new Map();
    // createdAnchors have the form of [[Anchors created on chainID], [...]]
    // and anchors in the subArrays of thhe same index should be linked together
    let createdVAnchors: VAnchor[][] = [];

    for (let chainID of vBridgeInput.chainIDs) {
      const initialGovernor = initialGovernors[chainID];
      // Create the bridgeSide
      let vBridgeInstance = await SignatureBridgeSide.createBridgeSide(deployers[chainID]);

      const handler = await AnchorHandler.createAnchorHandler(
        vBridgeInstance.contract.address,
        [],
        [],
        vBridgeInstance.admin
      );
      vBridgeInstance.setAnchorHandler(handler);

      // Create Treasury and TreasuryHandler
      const treasuryHandler = await TreasuryHandler.createTreasuryHandler(
        vBridgeInstance.contract.address,
        [],
        [],
        vBridgeInstance.admin
      );
      const treasury = await Treasury.createTreasury(
        treasuryHandler.contract.address,
        vBridgeInstance.admin
      );

      await vBridgeInstance.setTreasuryHandler(treasuryHandler);
      await vBridgeInstance.setTreasuryResourceWithSignature(treasury);

      // Create the Hasher and Verifier for the chain
      const hasherFactory = new KeccakHasher__factory(deployers[chainID]);
      let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
      await hasherInstance.deployed();

      // Check the addresses of the asset. If it is zero, deploy a native token wrapper
      let allowedNative: boolean = false;
      for (const tokenToBeWrapped of vBridgeInput.vAnchorInputs.asset[chainID]!) {
        // If passed '0' or zero address, token to be wrapped should support native.
        if (checkNativeAddress(tokenToBeWrapped)) {
          allowedNative = true;
        }
      }

      // Deploy TokenWrapperHandler
      const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(
        vBridgeInstance.contract.address,
        [],
        [],
        vBridgeInstance.admin
      );

      let tokenInstance: GovernedTokenWrapper;
      if (!vBridgeInput.webbTokens.get(chainID)) {
        tokenInstance = await GovernedTokenWrapper.createGovernedTokenWrapper(
          `webbWETH`,
          `webbWETH`,
          treasury.contract.address,
          tokenWrapperHandler.contract.address,
          '10000000000000000000000000',
          allowedNative,
          deployers[chainID]
        );
      } else {
        tokenInstance = vBridgeInput.webbTokens.get(chainID)!;
      }

      await vBridgeInstance.setTokenWrapperHandler(tokenWrapperHandler);
      await vBridgeInstance.setGovernedTokenResourceWithSignature(tokenInstance);

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
      const vAnchorInstance = await VAnchor.createOpenVAnchor(
        30,
        hasherInstance.address,
        handler.contract.address,
        tokenInstance.contract.address,
        deployers[chainID]
      );

      // grant minting rights to the anchor
      await tokenInstance.grantMinterRole(vAnchorInstance.contract.address);

      chainGroupedVAnchors.push(vAnchorInstance);
      vAnchors.set(OpenVBridge.createVAnchorIdString({ chainId: chainID }), vAnchorInstance);

      await OpenVBridge.setPermissions(vBridgeInstance, chainGroupedVAnchors);
      createdVAnchors.push(chainGroupedVAnchors);

      // Transfer ownership of the bridge to the initialGovernor
      const tx = await vBridgeInstance.transferOwnership(initialGovernor, 0);
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
    const linkedVAnchorMap = await OpenVBridge.createLinkedVAnchorMap(groupLinkedVAnchors);

    return new OpenVBridge(vBridgeSides, webbTokenAddresses, linkedVAnchorMap, vAnchors);
  }

  // The setPermissions method accepts initialized bridgeSide and anchors.
  // it creates the anchor handler and sets the appropriate permissions
  // for the bridgeSide/anchorHandler/anchor
  public static async setPermissions(
    vBridgeSide: SignatureBridgeSide,
    vAnchors: VAnchor[]
  ): Promise<void> {
    let tokenDenomination = '1000000000000000000'; // 1 ether
    for (let vAnchor of vAnchors) {
      await vBridgeSide.connectAnchorWithSignature(vAnchor);
      await vBridgeSide.executeMinWithdrawalLimitProposalWithSig(
        vAnchor,
        BigNumber.from(0).toString()
      );
      await vBridgeSide.executeMaxDepositLimitProposalWithSig(
        vAnchor,
        BigNumber.from(tokenDenomination).mul(1_000_000).toString()
      );
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
    intendedAnchor = this.vAnchors.get(OpenVBridge.createVAnchorIdString({ chainId }));
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

export default OpenVBridge;
