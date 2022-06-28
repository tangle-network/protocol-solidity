import { ethers, BigNumber, BigNumberish  } from 'ethers';
import { SignatureBridgeSide } from '@webb-tools/bridges';
import { MintableToken, GovernedTokenWrapper, TreasuryHandler, Treasury, TokenWrapperHandler } from "@webb-tools/tokens";
import { PoseidonT3__factory } from "@webb-tools/contracts";
import Verifier from "./Verifier";
import { AnchorIdentifier, GovernorConfig, DeployerConfig } from "@webb-tools/interfaces";
import { AnchorHandler, VAnchor } from "@webb-tools/anchors";
import { getChainIdType, ZkComponents } from "@webb-tools/utils";
import { CircomUtxo, Utxo } from "@webb-tools/sdk-core";
import { hexToU8a, u8aToHex } from '@polkadot/util';

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
  vBridgeSides: Map<number, SignatureBridgeSide>,
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
    public vBridgeSides: Map<number, SignatureBridgeSide>,

    // chainID => GovernedTokenWrapper (webbToken) address
    public webbTokenAddresses: Map<number, string>,

    // Mapping of resourceID => linkedVAnchor[]; so we know which
    // vanchors need updating when the anchor for resourceID changes state.
    public linkedVAnchors: Map<string, VAnchor[]>,

    // Mapping of anchorIdString => Anchor for easy anchor access
    public vAnchors: Map<string, VAnchor>,
  ) {}

  //might need some editing depending on whether anchor identifier structure changes
  public static createVAnchorIdString(vAnchorIdentifier: AnchorIdentifier): string {
    return `${vAnchorIdentifier.chainId.toString()}`;
  }

  public static createVAnchorIdentifier(vAnchorString: string): AnchorIdentifier | null {
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

  public static async deployVariableAnchorBridge(vBridgeInput: VBridgeInput, deployers: DeployerConfig, initialGovernors: GovernorConfig, smallCircuitZkComponents: ZkComponents, largeCircuitZkComponents: ZkComponents): Promise<VBridge> {
    
    let webbTokenAddresses: Map<number, string> = new Map();
    let vBridgeSides: Map<number, SignatureBridgeSide> = new Map();
    let vAnchors: Map<string, VAnchor> = new Map();
    // createdAnchors have the form of [[Anchors created on chainID], [...]]
    // and anchors in the subArrays of thhe same index should be linked together
    let createdVAnchors: VAnchor[][] = [];

    for (let chainID of vBridgeInput.chainIDs) {
      const initialGovernor = initialGovernors[chainID];
      // Create the bridgeSide
      let vBridgeInstance = await SignatureBridgeSide.createBridgeSide(
       initialGovernor,
       deployers[chainID],
      );

      const handler = await AnchorHandler.createAnchorHandler(vBridgeInstance.contract.address, [], [], vBridgeInstance.admin);
      vBridgeInstance.setAnchorHandler(handler);

      vBridgeSides.set(chainID, vBridgeInstance);

      // Create Treasury and TreasuryHandler
      const treasuryHandler = await TreasuryHandler.createTreasuryHandler(vBridgeInstance.contract.address, [],[], vBridgeInstance.admin);
      const treasury = await Treasury.createTreasury(treasuryHandler.contract.address, vBridgeInstance.admin);

      await vBridgeInstance.setTreasuryHandler(treasuryHandler);
      await vBridgeInstance.setTreasuryResourceWithSignature(treasury);

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
          deployers[chainID],
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
      webbTokenAddresses.set(
        chainID,
        tokenInstance.contract.address
      );
      
      let chainGroupedVAnchors: VAnchor[] = [];

      // loop through all the anchor sizes on the token
      const vAnchorInstance = await VAnchor.createVAnchor(
          verifierInstance.address,
          30,
          hasherInstance.address,
          handler.contract.address,
          tokenInstance.contract.address,
          vBridgeInput.chainIDs.length > 2 ? 7 : 1,
          smallCircuitZkComponents,
          largeCircuitZkComponents,
          deployers[chainID],
      );

      // grant minting rights to the anchor
      await tokenInstance.grantMinterRole(vAnchorInstance.contract.address); 

      chainGroupedVAnchors.push(vAnchorInstance);
      vAnchors.set(
          VBridge.createVAnchorIdString({ chainId: chainID }),
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
  public static async setPermissions(vBridgeSide: SignatureBridgeSide, vAnchors: VAnchor[]): Promise<void> {
    let tokenDenomination = '1000000000000000000' // 1 ether
    for (let vAnchor of vAnchors) {
      await vBridgeSide.connectAnchorWithSignature(vAnchor);
      await vBridgeSide.executeMinWithdrawalLimitProposalWithSig(
        vAnchor,
        BigNumber.from(0).toString(),
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
  };

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
    intendedAnchor = this.vAnchors.get(VBridge.createVAnchorIdString({ chainId }));
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
      vBridgeSides: this.vBridgeSides
    };
  }

  public async transact(
    inputs: Utxo[], 
    outputs: Utxo[], 
    fee: BigNumberish, 
    recipient: string,
    relayer: string,
    signer:ethers.Signer
  ) {
    const chainId = getChainIdType(await signer.getChainId());
    const signerAddress = await signer.getAddress();
    const vAnchor = this.getVAnchor(chainId);
    if (!vAnchor) {
       throw new Error("VAnchor does not exist on this chain");
    }
    await vAnchor.setSigner(signer);

    //do we have to check if amount is greater than 0 before the checks?????
    // Check that input dest chain is this chain
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
    // Approve spending if needed
    const userTokenAllowance = await tokenInstance.getAllowance(signerAddress, vAnchor.contract.address);
    if (userTokenAllowance.lt(publicAmount)) {
      await tokenInstance.approveSpending(vAnchor.contract.address);
    }

    const regeneratedInputs: Utxo[] = [];

    // Populate the leaves map
    const leavesMap: Record<string, Uint8Array[]> = {};
    leavesMap[chainId] = vAnchor.tree.elements().map((commitment) => hexToU8a(commitment.toHexString()))

    for (let input of inputs) {
      const inputTree = this.getVAnchor(Number(input.originChainId)).tree;

      if (!leavesMap[input.originChainId]) {
        leavesMap[input.originChainId] = inputTree.elements().map((commitment) => hexToU8a(commitment.toHexString()))
      }

      // update the utxo with the proper index 
      const utxoIndex = inputTree.getIndexByElement(u8aToHex(input.commitment));
      const newUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        amount: input.amount,
        originChainId: input.originChainId,
        chainId: input.chainId,
        blinding: hexToU8a(input.blinding),
        keypair: input.keypair,
        privateKey: hexToU8a(input.secret_key),
        index: utxoIndex.toString()
      });
      regeneratedInputs.push(newUtxo);
    }

    // Create dummy UTXOs to satisfy the circuit
    while (regeneratedInputs.length !== 2 && regeneratedInputs.length < 16) {
      regeneratedInputs.push(await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainId.toString(),
        originChainId: chainId.toString(),
        index: '0',
        amount: '0',
      }));
    }

    await vAnchor.transact(regeneratedInputs, outputs, leavesMap, fee, recipient, relayer);
    await this.update(chainId);
  }

  //token address is address of unwrapped erc20
  public async transactWrap(
    tokenAddress: string,
    inputs: Utxo[], 
    outputs: Utxo[], 
    fee: BigNumberish, 
    recipient: string,
    relayer: string,
    signer: ethers.Signer
  ) {
    
    const chainId = getChainIdType(await signer.getChainId());
    const signerAddress = await signer.getAddress();
    const vAnchor = this.getVAnchor(chainId);
    if (!vAnchor) {
       throw new Error("VAnchor does not exist on this chain");
    }
    await vAnchor.setSigner(signer);

    //do we have to check if amount is greater than 0 before the checks?
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

    const extAmount = BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))

    const publicAmount = extAmount.sub(fee);

    // Approve spending if needed
    const webbTokenAddress = await vAnchor.contract.token();
    if (tokenAddress != zeroAddress) {
      const tokenInstance = await MintableToken.tokenFromAddress(tokenAddress, signer);
      const userTokenAllowance = await tokenInstance.getAllowance(signerAddress, vAnchor.contract.address);
      if (userTokenAllowance.lt(publicAmount)) {
        await tokenInstance.approveSpending(webbTokenAddress);
      }
    }

    const regeneratedInputs: Utxo[] = [];

    // Populate the leaves map
    const leavesMap: Record<string, Uint8Array[]> = {};
    leavesMap[chainId] = vAnchor.tree.elements().map((commitment) => hexToU8a(commitment.toHexString()))

    for (let input of inputs) {
      const inputTree = this.getVAnchor(Number(input.originChainId)).tree;

      if (!leavesMap[input.originChainId]) {
        leavesMap[input.originChainId] = inputTree.elements().map((commitment) => hexToU8a(commitment.toHexString()))
      }

      // update the utxo with the proper index 
      const utxoIndex = inputTree.getIndexByElement(u8aToHex(input.commitment));
      const newUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        amount: input.amount,
        originChainId: input.originChainId,
        chainId: input.chainId,
        blinding: hexToU8a(input.blinding),
        keypair: input.keypair,
        privateKey: hexToU8a(input.secret_key),
        index: utxoIndex.toString()
      });
      regeneratedInputs.push(newUtxo);
    }

    // Create dummy UTXOs to satisfy the circuit
    while (regeneratedInputs.length !== 2 && regeneratedInputs.length < 16) {
      regeneratedInputs.push(await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainId.toString(),
        originChainId: chainId.toString(),
        index: '0',
        amount: '0',
      }));
    }

    await vAnchor.transactWrap(tokenAddress, regeneratedInputs, outputs, fee, recipient, relayer, leavesMap);
    await this.update(chainId);
  }
}

export default VBridge;
