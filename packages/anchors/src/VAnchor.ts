import { BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import {
  VAnchorTree as VAnchorTreeContract,
  VAnchorTree__factory,
  VAnchorEncodeInputs__factory,
  TokenWrapper__factory,
} from '@webb-tools/contracts';
import {
  toHex,
  Keypair,
  toFixedHex,
  Utxo,
  MerkleTree,
  median,
  mean,
  max,
  min,
  randomBN,
  CircomProvingManager,
  ProvingManagerSetupInput,
  MerkleProof,
  UtxoGenInput,
  CircomUtxo,
  FIELD_SIZE,
  LeafIdentifier,
} from '@webb-tools/sdk-core';
import {
  IVAnchor,
  IVariableAnchorExtData,
  IVariableAnchorPublicInputs,
} from '@webb-tools/interfaces';
import { WebbBridge } from './Common';
import { Deployer } from './Deployer';
import { hexToU8a, u8aToHex, getChainIdType, ZkComponents, ZERO_BYTES32 } from '@webb-tools/utils';

const zeroAddress = '0x0000000000000000000000000000000000000000';

export var gasBenchmark = [];
export var proofTimeBenchmark = [];
// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods
export class VAnchor extends WebbBridge implements IVAnchor {
  signer: ethers.Signer;
  contract: VAnchorTreeContract;
  tree: MerkleTree;
  // hex string of the connected root
  maxEdges: number;
  latestSyncedBlock: number;
  smallCircuitZkComponents: ZkComponents;
  largeCircuitZkComponents: ZkComponents;

  // The depositHistory stores leafIndex => information to create proposals (new root)
  depositHistory: Record<number, string>;
  token?: string;
  denomination?: string;
  provingManager: CircomProvingManager;

  constructor(
    contract: VAnchorTreeContract,
    signer: ethers.Signer,
    treeHeight: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents
  ) {
    super(contract, signer);
    this.signer = signer;
    this.contract = contract;
    this.tree = new MerkleTree(treeHeight);
    this.latestSyncedBlock = 0;
    this.maxEdges = maxEdges;
    this.depositHistory = {};
    this.smallCircuitZkComponents = smallCircuitZkComponents;
    this.largeCircuitZkComponents = largeCircuitZkComponents;
  }

  public static async create2VAnchor(
    deployer: Deployer,
    saltHex: string,
    verifier: string,
    levels: BigNumberish,
    hasher: string,
    handler: string,
    token: string,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const { contract: libraryContract } = await deployer.deploy(
      VAnchorEncodeInputs__factory,
      saltHex,
      signer
    );

    let libraryAddresses = {
      ['contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs']: libraryContract.address,
    };

    const argTypes = ['address', 'uint32', 'address', 'address', 'address', 'uint8'];
    const args = [verifier, levels, hasher, handler, token, maxEdges];
    const { contract: vanchor, receipt } = await deployer.deploy(
      VAnchorTree__factory,
      saltHex,
      signer,
      libraryAddresses,
      argTypes,
      args
    );
    const createdVAnchor = new VAnchor(
      vanchor,
      signer,
      BigNumber.from(levels).toNumber(),
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    console.log('vanchor', vanchor.deployTransaction);
    createdVAnchor.latestSyncedBlock = receipt.blockNumber!;
    createdVAnchor.token = token;
    return createdVAnchor;
  }

  public static async createVAnchor(
    verifier: string,
    levels: BigNumberish,
    hasher: string,
    handler: string,
    token: string,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const encodeLibraryFactory = new VAnchorEncodeInputs__factory(signer);
    const encodeLibrary = await encodeLibraryFactory.deploy();
    await encodeLibrary.deployed();

    const factory = new VAnchorTree__factory(
      { ['contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs']: encodeLibrary.address },
      signer
    );
    const vAnchor = await factory.deploy(verifier, levels, hasher, handler, token, maxEdges, {});
    await vAnchor.deployed();
    const createdVAnchor = new VAnchor(
      vAnchor,
      signer,
      BigNumber.from(levels).toNumber(),
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdVAnchor.latestSyncedBlock = vAnchor.deployTransaction.blockNumber!;
    createdVAnchor.token = token;
    const tx = await createdVAnchor.contract.initialize(
      BigNumber.from('1'),
      BigNumber.from(2).pow(256).sub(1)
    );
    await tx.wait();
    return createdVAnchor;
  }

  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const anchor = VAnchorTree__factory.connect(address, signer);
    const maxEdges = await anchor.maxEdges();
    const treeHeight = await anchor.levels();
    const createdAnchor = new VAnchor(
      anchor,
      signer,
      treeHeight,
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdAnchor.token = await anchor.token();
    return createdAnchor;
  }

  public static convertToPublicInputsStruct(args: any[]): IVariableAnchorPublicInputs {
    return {
      proof: args[0],
      roots: args[1],
      extensionRoots: '0x00',
      inputNullifiers: args[2],
      outputCommitments: args[3],
      publicAmount: args[4],
      extDataHash: args[5],
    };
  }

  // Sync the local tree with the tree on chain.
  // Start syncing from the given block number, otherwise zero.
  public async update(blockNumber?: number) {
    // const filter = this.contract.filters.Deposit();
    // const currentBlockNumber = await this.signer.provider!.getBlockNumber();
    // const events = await this.contract.queryFilter(filter, blockNumber || 0);
    // const commitments = events.map((event) => event.args.commitment);
    // this.tree.batch_insert(commitments);
    // this.latestSyncedBlock = currentBlockNumber;
  }

  // Proposal data is used to update linkedAnchors via bridge proposals
  // on other chains with this anchor's state
  public async getProposalData(resourceID: string, leafIndex?: number): Promise<string> {
    // If no leaf index passed in, set it to the most recent one.
    if (!leafIndex) {
      leafIndex = this.tree.number_of_elements() - 1;
    }

    const merkleRoot = this.depositHistory[leafIndex];
    return this.genProposalData(resourceID, merkleRoot, leafIndex);
  }

  public async populateRootsForProof(): Promise<BigNumber[]> {
    const neighborEdges = await this.contract.getLatestNeighborEdges();
    const neighborRootInfos = neighborEdges.map((rootData) => {
      return rootData.root;
    });
    let thisRoot = await this.contract.getLastRoot();
    return [thisRoot, ...neighborRootInfos];
  }

  public async getClassAndContractRoots() {
    return [this.tree.root(), await this.contract.getLastRoot()];
  }

  /**
   *
   * @param input A UTXO object that is inside the tree
   * @returns
   */
  public getMerkleProof(input: Utxo): MerkleProof {
    let inputMerklePathIndices: number[];
    let inputMerklePathElements: BigNumber[];

    if (Number(input.amount) > 0) {
      if (input.index < 0) {
        throw new Error(`Input commitment ${u8aToHex(input.commitment)} was not found`);
      }
      const path = this.tree.path(input.index);
      inputMerklePathIndices = path.pathIndices;
      inputMerklePathElements = path.pathElements;
    } else {
      inputMerklePathIndices = new Array(this.tree.levels).fill(0);
      inputMerklePathElements = new Array(this.tree.levels).fill(0);
    }

    return {
      element: BigNumber.from(u8aToHex(input.commitment)),
      pathElements: inputMerklePathElements,
      pathIndices: inputMerklePathIndices,
      merkleRoot: this.tree.root(),
    };
  }

  public generatePublicInputs(
    proof: any,
    roots: BigNumber[],
    inputs: Utxo[],
    outputs: Utxo[],
    publicAmount: BigNumberish,
    extDataHash: BigNumber
  ): IVariableAnchorPublicInputs {
    // public inputs to the contract
    const args: IVariableAnchorPublicInputs = {
      proof: `0x${proof}`,
      roots: `0x${roots.map((x) => toFixedHex(x).slice(2)).join('')}`,
      extensionRoots: '0x00',
      inputNullifiers: inputs.map((x) => BigNumber.from(toFixedHex('0x' + x.nullifier))),
      outputCommitments: [
        BigNumber.from(toFixedHex(u8aToHex(outputs[0].commitment))),
        BigNumber.from(toFixedHex(u8aToHex(outputs[1].commitment))),
      ],
      publicAmount: toFixedHex(publicAmount),
      extDataHash,
    };

    return args;
  }

  /**
   * Given a list of leaves and a latest synced block, update internal tree state
   * The function will create a new tree, and check on chain root before updating its member variable
   * If the passed leaves match on chain data,
   *   update this instance and return true
   * else
   *   return false
   */
  public async setWithLeaves(leaves: string[], syncedBlock?: number): Promise<Boolean> {
    let newTree = new MerkleTree(this.tree.levels, leaves);
    let root = toFixedHex(newTree.root());
    let validTree = await this.contract.isKnownRoot(root);

    if (validTree) {
      let index = 0;
      for (const leaf of newTree.elements()) {
        this.depositHistory[index] = toFixedHex(this.tree.root());
        index++;
      }
      if (!syncedBlock) {
        syncedBlock = await this.signer.provider.getBlockNumber();
      }
      this.tree = newTree;
      this.latestSyncedBlock = syncedBlock;
      return true;
    } else {
      return false;
    }
  }

  public async getGasBenchmark() {
    const gasValues = gasBenchmark.map(Number);
    const meanGas = mean(gasValues);
    const medianGas = median(gasValues);
    const maxGas = max(gasValues);
    const minGas = min(gasValues);
    return {
      gasValues,
      meanGas,
      medianGas,
      maxGas,
      minGas,
    };
    // return gasBenchmark;
  }
  public async getProofTimeBenchmark() {
    const meanTime = mean(proofTimeBenchmark);
    const medianTime = median(proofTimeBenchmark);
    const maxTime = max(proofTimeBenchmark);
    const minTime = min(proofTimeBenchmark);
    return {
      proofTimeBenchmark,
      meanTime,
      medianTime,
      maxTime,
      minTime,
    };
  }
  public static convertToExtDataStruct(args: any[]): IVariableAnchorExtData {
    return {
      recipient: args[0],
      extAmount: args[1],
      relayer: args[2],
      fee: args[3],
      refund: args[4],
      token: args[5],
      encryptedOutput1: args[6],
      encryptedOutput2: args[7],
    };
  }

  /**
   *
   * @param input A UTXO object that is inside the tree
   * @returns an object with two fields, publicInput
   */
  public async setupTransaction(
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    leavesMap: Record<string, Uint8Array[]>
  ) {
    // first, check if the merkle root is known on chain - if not, then update
    if (wrapUnwrapToken.length === 0) {
      wrapUnwrapToken = this.token;
    }

    if(outputs.length !== 2) {
      throw new Error('Only two outputs are supported');
    }
    const chainId = getChainIdType(await this.signer.getChainId());
    const roots = await this.populateRootsForProof();
    let extAmount = this.getExtAmount(inputs, outputs, fee);

    // calculate the sum of input notes (for calculating the public amount)
    let sumInputUtxosAmount: BigNumberish = 0;

    // Pass the identifier for leaves alongside the proof input
    let leafIds: LeafIdentifier[] = [];

    for (const inputUtxo of inputs) {
      sumInputUtxosAmount = BigNumber.from(sumInputUtxosAmount).add(inputUtxo.amount);
      leafIds.push({
        index: inputUtxo.index,
        typedChainId: Number(inputUtxo.originChainId),
      });
    }

    const encryptedCommitments: [Uint8Array, Uint8Array] = [
      hexToU8a(outputs[0].encrypt()),
      hexToU8a(outputs[1].encrypt()),
    ];

    const proofInput: ProvingManagerSetupInput<'vanchor'> = {
      inputUtxos: inputs,
      leavesMap,
      leafIds,
      roots: roots.map((root) => hexToU8a(root.toHexString())),
      chainId: chainId.toString(),
      output: [outputs[0], outputs[1]],
      encryptedCommitments,
      publicAmount: BigNumber.from(extAmount).sub(fee).add(FIELD_SIZE).mod(FIELD_SIZE).toString(),
      provingKey:
        inputs.length > 2 ? this.largeCircuitZkComponents.zkey : this.smallCircuitZkComponents.zkey,
      relayer: hexToU8a(relayer),
      recipient: hexToU8a(recipient),
      extAmount: toFixedHex(BigNumber.from(extAmount)),
      fee: BigNumber.from(fee).toString(),
      refund: BigNumber.from(refund).toString(),
      token: hexToU8a(wrapUnwrapToken),
    };

    inputs.length > 2
      ? (this.provingManager = new CircomProvingManager(
          this.largeCircuitZkComponents.wasm,
          this.tree.levels,
          null
        ))
      : (this.provingManager = new CircomProvingManager(
          this.smallCircuitZkComponents.wasm,
          this.tree.levels,
          null
        ));

    const proof = await this.provingManager.prove('vanchor', proofInput);

    const publicInputs: IVariableAnchorPublicInputs = this.generatePublicInputs(
      proof.proof,
      roots,
      inputs,
      outputs,
      proofInput.publicAmount,
      BigNumber.from(u8aToHex(proof.extDataHash))
    );

    const extData: IVariableAnchorExtData = {
      recipient: toFixedHex(proofInput.recipient, 20),
      extAmount: toFixedHex(proofInput.extAmount),
      relayer: toFixedHex(proofInput.relayer, 20),
      fee: toFixedHex(proofInput.fee),
      refund: toFixedHex(proofInput.refund),
      token: toFixedHex(proofInput.token, 20),
      encryptedOutput1: u8aToHex(proofInput.encryptedCommitments[0]),
      encryptedOutput2: u8aToHex(proofInput.encryptedCommitments[1]),
    };

    return {
      extAmount,
      extData,
      publicInputs,
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
    leavesMap: Record<string, Uint8Array[]>
  ): Promise<ethers.ContractReceipt> {
    // Default UTXO chain ID will match with the configured signer's chain ID
    inputs = await this.padUtxos(inputs, 16);
    outputs = await this.padUtxos(outputs, 2);

    const { extData, extAmount, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      fee,
      refund,
      recipient,
      relayer,
      wrapUnwrapToken,
      leavesMap
    );

    let options = await this.getWrapUnwrapOptions(extAmount, wrapUnwrapToken)

    const tx = await this.contract.transact(
      publicInputs.proof,
      ZERO_BYTES32,
      {
        recipient: extData.recipient,
        extAmount: extData.extAmount,
        relayer: extData.relayer,
        fee: extData.fee,
        refund: extData.refund,
        token: extData.token,
      },
      {
        roots: publicInputs.roots,
        extensionRoots: '0x',
        inputNullifiers: publicInputs.inputNullifiers,
        outputCommitments: [publicInputs.outputCommitments[0], publicInputs.outputCommitments[1]],
        publicAmount: publicInputs.publicAmount,
        extDataHash: publicInputs.extDataHash,
      },
      {
        encryptedOutput1: extData.encryptedOutput1,
        encryptedOutput2: extData.encryptedOutput2,
      },
      options
    );
    const receipt = await tx.wait();

    // Add the leaves to the tree
    this.updateTreeState(outputs);

    return receipt;
  }

  public updateTreeState(outputs: Utxo[]): void {
    outputs.forEach((x) => {
      this.tree.insert(u8aToHex(x.commitment));
      let numOfElements = this.tree.number_of_elements();
      this.depositHistory[numOfElements - 1] = toFixedHex(this.tree.root().toString());
    });
  }
  public validateInputs(inputs: Utxo[]): void {
    inputs.map((utxo) => {
      if (utxo.originChainId === undefined) {
        throw new Error('Input Utxo does not have a configured originChainId');
      }
    });
  }
  public async generateProof(
    roots: string[],
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    tokenAddress: string,
    recipient: string,
    relayer: string,
    leavesMap: Record<string, Uint8Array[]>
  ) {
    let extAmount = this.getExtAmount(inputs, outputs, fee);

    const encryptedCommitments: [Uint8Array, Uint8Array] = [
      hexToU8a(outputs[0].encrypt()),
      hexToU8a(outputs[1].encrypt()),
    ];
    const chainId = getChainIdType(await this.signer.getChainId());

    let sumInputUtxosAmount: BigNumberish = 0;
    let leafIds: LeafIdentifier[] = [];

    for (const inputUtxo of inputs) {
      sumInputUtxosAmount = BigNumber.from(sumInputUtxosAmount).add(inputUtxo.amount);
      leafIds.push({
        index: inputUtxo.index,
        typedChainId: Number(inputUtxo.originChainId),
      });
    }

    const proofInput: ProvingManagerSetupInput<'vanchor'> = {
      inputUtxos: inputs,
      leavesMap,
      leafIds,
      roots: roots.map((root) => hexToU8a(root)),
      chainId: chainId.toString(),
      output: [outputs[0], outputs[1]],
      encryptedCommitments,
      publicAmount: BigNumber.from(extAmount).sub(fee).add(FIELD_SIZE).mod(FIELD_SIZE).toString(),
      provingKey:
        inputs.length > 2 ? this.largeCircuitZkComponents.zkey : this.smallCircuitZkComponents.zkey,
      relayer: hexToU8a(relayer),
      recipient: hexToU8a(recipient),
      extAmount: toFixedHex(BigNumber.from(extAmount)),
      fee: BigNumber.from(fee).toString(),
      refund: BigNumber.from(refund).toString(),
      token: hexToU8a(tokenAddress),
    };

    inputs.length > 2
      ? (this.provingManager = new CircomProvingManager(
          this.largeCircuitZkComponents.wasm,
          this.tree.levels,
          null
        ))
      : (this.provingManager = new CircomProvingManager(
          this.smallCircuitZkComponents.wasm,
          this.tree.levels,
          null
        ));

    const proof = await this.provingManager.prove('vanchor', proofInput);
    return { proof, extAmount, proofInput };
  }

  public async registerAndTransact(
    owner: string,
    keyData: string,
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    leavesMap: Record<string, Uint8Array[]>
  ): Promise<ethers.ContractReceipt> {
    inputs = await this.padUtxos(inputs, 16);
    outputs = await this.padUtxos(outputs, 2);

    const { extAmount, extData, publicInputs } = await this.setupTransaction(
      inputs,
      [outputs[0], outputs[1]],
      fee,
      refund,
      recipient,
      relayer,
      wrapUnwrapToken,
      leavesMap
    );

    let options = await this.getWrapUnwrapOptions(extAmount, wrapUnwrapToken)
    let tx = await this.contract.registerAndTransact(
      { owner, keyData: keyData },
      publicInputs.proof,
      ZERO_BYTES32,
      {
        recipient: extData.recipient,
        extAmount: extData.extAmount,
        relayer: extData.relayer,
        fee: extData.fee,
        refund: extData.refund,
        token: extData.token,
      },
      {
        roots: publicInputs.roots,
        extensionRoots: [],
        inputNullifiers: publicInputs.inputNullifiers,
        outputCommitments: [
          BigNumber.from(publicInputs.outputCommitments[0]),
          BigNumber.from(publicInputs.outputCommitments[1]),
        ],
        publicAmount: publicInputs.publicAmount,
        extDataHash: publicInputs.extDataHash,
      },
      {
        encryptedOutput1: extData.encryptedOutput1,
        encryptedOutput2: extData.encryptedOutput2,
      },
      options
    );
    const receipt = await tx.wait();

    // Add the leaves to the tree
    this.updateTreeState(outputs);

    return receipt;
  }
}

export default VAnchor;
