import { ethers, BigNumber, BigNumberish, BaseContract } from 'ethers';
import {
  MintableToken,
  FungibleTokenWrapper,
  TreasuryHandler,
  Treasury,
  TokenWrapperHandler,
} from '@webb-tools/tokens';
import { GovernorConfig, DeployerConfig, IVAnchor } from '@webb-tools/interfaces';
import { AnchorHandler, PoseidonHasher, VAnchor, WebbContracts } from '@webb-tools/anchors';
import { hexToU8a, u8aToHex, getChainIdType, ZkComponents } from '@webb-tools/utils';
import { CircomUtxo, Utxo } from '@webb-tools/sdk-core';
import { Verifier } from '@webb-tools/anchors';
import { SignatureBridgeSide } from './SignatureBridgeSide';

export type ExistingAssetInput = {
  // A record of chainId => address of wrappable tokens to be supported in the webbToken.
  asset: Record<number, string[]>;
};

// Token config to to create new token
export type TokenConfig = {
  name: string;
  symbol: string;
};

// Users define an input for a completely new bridge
export type VBridgeInput = {
  // The tokens which should be supported after deploying from this bridge input
  vAnchorInputs: ExistingAssetInput;

  // The IDs of the chains to deploy to
  chainIds: number[];

  // The number of max edges for vanchors, if not provided, maxEdges is derived from passed chainIDs.
  maxEdges?: number;

  // Config to create new tokens
  tokenConfigs?: Map<number, TokenConfig | undefined>;

  // Existing webb tokens can be connected
  webbTokens: Map<number, FungibleTokenWrapper | undefined>;
};

export type BridgeConfig<A extends BaseContract> = {
  // The addresses of tokens available to be transferred over this bridge config
  // chainId => FungibleTokenWrapperAddress
  webbTokenAddresses: Map<number, string | undefined>;

  // The addresses of the anchors for the FungibleTokenWrapper
  // {anchorIdentifier} => anchorAddress
  vAnchors: Map<string, IVAnchor<A>>;

  // The addresses of the Bridge contracts (bridgeSides) to interact with
  vBridgeSides: Map<number, SignatureBridgeSide<A>>;
};

// Default token config
const defaultTokenConfig: TokenConfig = {
  name: 'webbWETH',
  symbol: 'webbWETH',
};

const zeroAddress = '0x0000000000000000000000000000000000000000';

function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}

// A bridge is
export class VBridge<A extends BaseContract> {
  private constructor(
    // Mapping of chainId => vBridgeSide
    public vBridgeSides: Map<number, SignatureBridgeSide<A>>,

    // chainID => FungibleTokenWrapper (webbToken) address
    public webbTokenAddresses: Map<number, string>,

    // Mapping of resourceID => linkedVAnchor[]; so we know which
    // vanchors need updating when the anchor for resourceID changes state.
    public linkedVAnchors: Map<string, IVAnchor<A>[]>,

    // Mapping of anchorIdString => Anchor for easy anchor access
    public vAnchors: Map<string, IVAnchor<A>>
  ) {}

  //might need some editing depending on whether anchor identifier structure changes
  public static createVAnchorIdString(chainId: BigNumberish): string {
    return chainId.toString();
  }

  // Takes as input a 2D array [[anchors to link together], [...]]
  // And returns a map of resourceID => linkedAnchor[]
  public static async createLinkedVAnchorMap<A extends BaseContract>(
    createdVAnchors: IVAnchor<A>[][]
  ): Promise<Map<string, IVAnchor<A>[]>> {
    let linkedVAnchorMap = new Map<string, IVAnchor<A>[]>();
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
  public static async deployVariableAnchorBridge<A extends BaseContract>(
    vBridgeInput: VBridgeInput,
    deployers: DeployerConfig,
    initialGovernors: GovernorConfig,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents
  ): Promise<VBridge<A>> {
    let webbTokenAddresses: Map<number, string> = new Map();
    let vBridgeSides: Map<number, SignatureBridgeSide<A>> = new Map();
    let vAnchors: Map<string, IVAnchor<A>> = new Map();
    // createdAnchors have the form of [[Anchors created on chainID], [...]]
    // and anchors in the subArrays of thhe same index should be linked together
    let createdVAnchors: IVAnchor<A>[][] = [];

    // Determine the maxEdges for the anchors on this VBridge deployment
    let maxEdges = vBridgeInput.maxEdges ?? vBridgeInput.chainIds.length > 2 ? 7 : 1;

    for (let chainId of vBridgeInput.chainIds) {
      const initialGovernor = initialGovernors[chainId];
      // Create the bridgeSide
      let vBridgeInstance = await SignatureBridgeSide.createBridgeSide(deployers[chainId]);

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
      const hasherInstance = await PoseidonHasher.createPoseidonHasher(deployers[chainId]);

      const verifier = await Verifier.createVerifier(deployers[chainId]);
      let verifierInstance = verifier.contract;

      // Check the addresses of the asset. If it is zero, deploy a native token wrapper
      let allowedNative: boolean = false;
      for (const tokenToBeWrapped of vBridgeInput.vAnchorInputs.asset[chainId]!) {
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

      let tokenInstance: FungibleTokenWrapper;
      if (!vBridgeInput.webbTokens.get(chainId)) {
        let tokenConfig = vBridgeInput.tokenConfigs?.get(chainId) ?? defaultTokenConfig;
        tokenInstance = await FungibleTokenWrapper.createFungibleTokenWrapper(
          tokenConfig.name,
          tokenConfig.symbol,
          0,
          treasury.contract.address,
          tokenWrapperHandler.contract.address,
          '10000000000000000000000000',
          allowedNative,
          deployers[chainId]
        );
      } else {
        tokenInstance = vBridgeInput.webbTokens.get(chainId)!;
      }

      await vBridgeInstance.setTokenWrapperHandler(tokenWrapperHandler);
      await vBridgeInstance.setFungibleTokenResourceWithSignature(tokenInstance);

      // Add all token addresses to the governed token instance.
      for (const tokenToBeWrapped of vBridgeInput.vAnchorInputs.asset[chainId]!) {
        // if the address is not '0', then add it
        if (!checkNativeAddress(tokenToBeWrapped)) {
          await vBridgeInstance.executeAddTokenProposalWithSig(tokenInstance, tokenToBeWrapped);
        }
      }

      // append each token
      webbTokenAddresses.set(chainId, tokenInstance.contract.address);

      let chainGroupedVAnchors: IVAnchor<A>[] = [];

      // loop through all the anchor sizes on the token
      const vAnchorInstance = await VAnchor.createVAnchor(
        verifierInstance.address,
        30,
        hasherInstance.contract.address,
        handler.contract.address,
        tokenInstance.contract.address,
        maxEdges,
        smallCircuitZkComponents,
        largeCircuitZkComponents,
        deployers[chainId]
      );

      // grant minting rights to the anchor
      await tokenInstance.grantMinterRole(vAnchorInstance.contract.address);

      chainGroupedVAnchors.push(vAnchorInstance as unknown as IVAnchor<A>);
      vAnchors.set(
        VBridge.createVAnchorIdString(chainId),
        vAnchorInstance as unknown as IVAnchor<A>
      );

      await VBridge.setPermissions(vBridgeInstance, chainGroupedVAnchors);
      createdVAnchors.push(chainGroupedVAnchors);

      const governorAddress =
        typeof initialGovernor === 'string' ? initialGovernor : initialGovernor.address;
      const governorNonce = typeof initialGovernor === 'string' ? 0 : initialGovernor.nonce;
      // Transfer ownership of the bridge to the initialGovernor
      const tx = await vBridgeInstance.transferOwnership(governorAddress, governorNonce);
      await tx.wait();
      vBridgeSides.set(chainId, vBridgeInstance);
    }

    // All anchors created, massage data to group anchors which should be linked together
    let groupLinkedVAnchors: IVAnchor<A>[][] = [];

    // all subarrays will have the same number of elements
    for (let i = 0; i < createdVAnchors[0].length; i++) {
      let linkedAnchors: IVAnchor<A>[] = [];
      for (let j = 0; j < createdVAnchors.length; j++) {
        linkedAnchors.push(createdVAnchors[j][i]);
      }
      groupLinkedVAnchors.push(linkedAnchors);
    }

    // link the anchors
    const linkedVAnchorMap = await VBridge.createLinkedVAnchorMap(groupLinkedVAnchors);

    return new VBridge(vBridgeSides, webbTokenAddresses, linkedVAnchorMap, vAnchors);
  }

  // The setPermissions method accepts initialized bridgeSide and anchors.
  // it creates the anchor handler and sets the appropriate permissions
  // for the bridgeSide/anchorHandler/anchor
  public static async setPermissions<A extends BaseContract>(
    vBridgeSide: SignatureBridgeSide<A>,
    vAnchors: IVAnchor<A>[]
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
  public async updateLinkedVAnchors(srcAnchor: IVAnchor<A>) {
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
    let intendedAnchor: IVAnchor<A>;
    intendedAnchor = this.vAnchors.get(VBridge.createVAnchorIdString(chainId));
    return intendedAnchor;
  }

  // Returns the address of the webbToken which wraps the given token name.
  public getWebbTokenAddress(chainId: number): string | undefined {
    return this.webbTokenAddresses.get(chainId);
  }

  public exportConfig(): BridgeConfig<A> {
    return {
      webbTokenAddresses: this.webbTokenAddresses,
      vAnchors: this.vAnchors,
      vBridgeSides: this.vBridgeSides,
    };
  }

  public async transact(
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    signer: ethers.Signer
  ) {
    const chainId = getChainIdType(await signer.getChainId());
    const signerAddress = await signer.getAddress();
    const vAnchor = this.getVAnchor(chainId);
    if (!vAnchor) {
      throw new Error('VAnchor does not exist on this chain');
    }
    await vAnchor.setSigner(signer);

    // Check that input dest chain is this chain
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i].chainId.toString() !== chainId.toString()) {
        throw new Error('Trying to spend an input with wrong destination chainId');
      }
    }

    //check that output origin chain is this chain
    for (let i = 0; i < outputs.length; i++) {
      if (outputs[i].originChainId.toString() !== chainId.toString()) {
        throw new Error('Trying to form an output with the wrong originChainId');
      }
    }

    const webbTokenAddress = await vAnchor.getToken();

    if (!webbTokenAddress) {
      throw new Error('Token not supported');
    }

    const extAmount = BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)));

    const publicAmount = extAmount.sub(fee);

    // If the wrapUnwrapToken is unspecified ('') then we assume that
    // the user is trying to transact directly with the webbToken. We instead
    // check if the anchor's allowed to spend webbToken funds from the user.
    if (wrapUnwrapToken.length === 0) {
      const tokenInstance = await MintableToken.tokenFromAddress(webbTokenAddress, signer);
      const userTokenAllowance = await tokenInstance.getAllowance(
        signerAddress,
        vAnchor.contract.address
      );
      if (userTokenAllowance.lt(publicAmount)) {
        await tokenInstance.approveSpending(vAnchor.contract.address, publicAmount);
      }

      wrapUnwrapToken = webbTokenAddress;
    } else if (wrapUnwrapToken != zeroAddress) {
      const tokenInstance = await MintableToken.tokenFromAddress(wrapUnwrapToken, signer);
      const userTokenAllowance = await tokenInstance.getAllowance(signerAddress, webbTokenAddress);
      if (userTokenAllowance.lt(publicAmount)) {
        await tokenInstance.approveSpending(webbTokenAddress, publicAmount);
      }
    }

    // Populate the leaves map
    const leavesMap: Record<string, Uint8Array[]> = {};

    // Always include the leaves of the chain which we are interacting on
    leavesMap[chainId] = (vAnchor as unknown as VAnchor).tree
      .elements()
      .map((commitment) => hexToU8a(commitment.toHexString()));

    for (let input of inputs) {
      const inputTree = (this.getVAnchor(Number(input.originChainId)) as unknown as VAnchor).tree;

      if (!leavesMap[input.originChainId]) {
        leavesMap[input.originChainId] = inputTree
          .elements()
          .map((commitment) => hexToU8a(commitment.toHexString()));
      }

      // update the utxo with the proper index
      const utxoIndex = inputTree.getIndexByElement(u8aToHex(input.commitment));
      input.setIndex(utxoIndex);
    }

    // Create dummy UTXOs to satisfy the circuit
    while (inputs.length !== 2 && inputs.length < 16) {
      inputs.push(
        await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainId.toString(),
          originChainId: chainId.toString(),
          index: '0',
          amount: '0',
        })
      );
    }

    await (vAnchor as unknown as VAnchor).transact(
      inputs,
      outputs,
      fee,
      refund,
      recipient,
      relayer,
      wrapUnwrapToken,
      leavesMap
    );
    await this.update(chainId);
  }
}

export default VBridge;
