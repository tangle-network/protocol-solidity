import {
  LinkableIncrementalBinaryTree__factory,
  VAnchorEncodeInputs__factory,
  VAnchorForest as VAnchorForestContract,
  VAnchorForest__factory,
} from '@webb-tools/contracts';
import {
  CircomProvingManager,
  LeafIdentifier,
  MerkleTree,
  Utxo,
  generateVariableWitnessInput,
  getVAnchorExtDataHash,
  max,
  mean,
  median,
  min,
  toFixedHex,
} from '@webb-tools/sdk-core';
import { poseidon_gencontract as poseidonContract } from 'circomlibjs';
import { BigNumber, BigNumberish, PayableOverrides, ethers } from 'ethers';
import { groth16 } from 'snarkjs';

// import { MerkleTree } from "."
import { IVariableAnchorExtData, IVariableAnchorPublicInputs } from '@webb-tools/interfaces';
import {
  UTXOInputs,
  ZERO_BYTES32,
  ZkComponents,
  getChainIdType,
  hexToU8a,
  u8aToHex,
} from '@webb-tools/utils';
import { WebbBridge } from './Common';
import { Deployer } from './Deployer';
import { OverridesWithFrom, SetupTransactionResult, TransactionOptions } from './types';

export var gasBenchmark = [];
export var proofTimeBenchmark = [];
// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods
export class VAnchorForest extends WebbBridge {
  contract: VAnchorForestContract;
  forest: MerkleTree;

  maxEdges: number;
  latestSyncedBlock: number;
  smallCircuitZkComponents: ZkComponents;
  largeCircuitZkComponents: ZkComponents;

  token?: string;
  denomination?: string;
  provingManager: CircomProvingManager;

  constructor(
    contract: VAnchorForestContract,
    signer: ethers.Signer,
    forestHeight: number,
    treeHeight: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents
  ) {
    super(contract, signer);
    this.signer = signer;
    this.contract = contract;
    this.forest = new MerkleTree(forestHeight);
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
    forestLevels: BigNumberish,
    subtreeLevels: BigNumberish,
    hasher: string,
    handler: string,
    token: string,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    // const saltHex = ethers.utils.id(salt)
    const { contract: encodeLibrary } = await deployer.deploy(
      VAnchorEncodeInputs__factory,
      saltHex,
      signer
    );

    const poseidonABI = poseidonContract.generateABI(2);
    const poseidonBytecode = poseidonContract.createCode(2);
    const poseidonInitCode = poseidonBytecode + Deployer.encode([], []);

    const { address: poseidonLibAddr } = await deployer.deployInitCode(
      saltHex,
      signer,
      poseidonInitCode
    );

    const LinkableIncrementalBinaryTreeLibs = {
      ['contracts/hashers/Poseidon.sol:PoseidonT3']: poseidonLibAddr,
    };
    const { contract: linkableIncrementalBinaryTree } = await deployer.deploy(
      LinkableIncrementalBinaryTree__factory,
      saltHex,
      signer,
      LinkableIncrementalBinaryTreeLibs
    );
    const libraryAddresses = {
      ['contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs']: encodeLibrary.address,
      ['contracts/hashers/Poseidon.sol:PoseidonT3']: poseidonLibAddr,
      ['contracts/trees/LinkableIncrementalBinaryTree.sol:LinkableIncrementalBinaryTree']:
        linkableIncrementalBinaryTree.address,
    };
    const argTypes = ['address', 'uint32', 'uint32', 'address', 'address', 'address', 'uint8'];
    const args = [verifier, forestLevels, subtreeLevels, hasher, handler, token, maxEdges];
    const { contract: vAnchor, receipt } = await deployer.deploy(
      VAnchorForest__factory,
      saltHex,
      signer,
      libraryAddresses,
      argTypes,
      args
    );
    // await vAnchor.deployed();
    const createdVAnchor = new VAnchorForest(
      vAnchor,
      signer,
      BigNumber.from(forestLevels).toNumber(),
      BigNumber.from(subtreeLevels).toNumber(),
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdVAnchor.latestSyncedBlock = receipt.blockNumber!;
    createdVAnchor.token = token;
    return createdVAnchor;
  }

  public static async createVAnchor(
    verifier: string,
    forestLevels: BigNumberish,
    subtreeLevels: BigNumberish,
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
    const poseidonABI = poseidonContract.generateABI(2);
    const poseidonBytecode = poseidonContract.createCode(2);

    const PoseidonLibFactory = new ethers.ContractFactory(poseidonABI, poseidonBytecode, signer);
    const poseidonLib = await PoseidonLibFactory.deploy();
    await poseidonLib.deployed();

    const LinkableIncrementalBinaryTree = new LinkableIncrementalBinaryTree__factory(
      {
        ['contracts/hashers/Poseidon.sol:PoseidonT3']: poseidonLib.address,
      },
      signer
    );
    const linkableIncrementalBinaryTree = await LinkableIncrementalBinaryTree.deploy();
    await linkableIncrementalBinaryTree.deployed();
    const factory = new VAnchorForest__factory(
      {
        ['contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs']: encodeLibrary.address,
        ['contracts/hashers/Poseidon.sol:PoseidonT3']: poseidonLib.address,
        ['contracts/trees/LinkableIncrementalBinaryTree.sol:LinkableIncrementalBinaryTree']:
          linkableIncrementalBinaryTree.address,
      },
      signer
    );
    const vAnchor = await factory.deploy(
      verifier,
      forestLevels,
      subtreeLevels,
      hasher,
      handler,
      token,
      maxEdges,
      {}
    );
    await vAnchor.deployed();
    const createdVAnchor = new VAnchorForest(
      vAnchor,
      signer,
      BigNumber.from(forestLevels).toNumber(),
      BigNumber.from(subtreeLevels).toNumber(),
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
    const anchor = VAnchorForest__factory.connect(address, signer);
    const maxEdges = await anchor.maxEdges();
    const forestHeight = await anchor.forestLevels();
    const subtreeHeight = await anchor.subtreeLevels();
    const createdAnchor = new VAnchorForest(
      anchor,
      signer,
      forestHeight,
      subtreeHeight,
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
      extensionRoots: '0x',
      inputNullifiers: args[2],
      outputCommitments: args[3],
      publicAmount: args[4],
      extDataHash: args[5],
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

  public async populateRootsForProof(): Promise<BigNumber[]> {
    const neighborEdges = await this.contract.getLatestNeighborEdges();
    const neighborRootInfos = neighborEdges.map((rootData) => {
      return rootData.root;
    });
    let thisRoot = await this.contract.getLastRoot();
    return [thisRoot, ...neighborRootInfos];
  }

  /**
   *
   * @param input A UTXO object that is inside the tree
   * @returns
   */
  public override getMerkleProof(input: Utxo): any {
    let inputSubtreePathIndices: number[];
    let inputSubtreePathElements: BigNumber[];
    let inputForestPathIndices: number[];
    let inputForestPathElements: BigNumber[];

    if (Number(input.amount) > 0) {
      if (!input.index || input.index < 0) {
        throw new Error(`Input commitment ${u8aToHex(input.commitment)} was not found`);
      }
      const subtreePath = this.tree.path(input.index);
      const idx = this.forest.indexOf(subtreePath.merkleRoot.toString());
      const forestPath = this.forest.path(idx);
      inputSubtreePathIndices = subtreePath.pathIndices;
      inputSubtreePathElements = subtreePath.pathElements;
      inputForestPathIndices = forestPath.pathIndices;
      inputForestPathElements = forestPath.pathElements;
    } else {
      inputSubtreePathIndices = new Array(this.tree.levels).fill(0);
      inputSubtreePathElements = new Array(this.tree.levels).fill(0);
      inputForestPathIndices = new Array(this.forest.levels).fill(0);
      inputForestPathElements = new Array(this.forest.levels).fill(0);
    }

    return {
      element: BigNumber.from(u8aToHex(input.commitment)),
      pathElements: inputSubtreePathElements,
      pathIndices: inputSubtreePathIndices,
      forestPathElements: inputForestPathElements,
      forestPathIndices: inputForestPathIndices,
      merkleRoot: this.forest.root(),
    };
  }

  public async generatePublicInputs(
    proof: any,
    nIns: number = 2,
    nOuts: number = 2,
    maxEdges: number = 2
    // ): IVariableAnchorPublicInputs {
  ): Promise<any> {
    const byte_calldata = await groth16.exportSolidityCallData(proof.proof, proof.publicSignals);
    // public inputs to the contract
    proof = await this.encodeSolidityProof(proof, byte_calldata);
    const publicInputs = JSON.parse('[' + byte_calldata + ']')[3];

    const publicAmount = publicInputs[0];
    const extDataHash = publicInputs[1];
    const inputNullifiers = publicInputs.slice(2, 2 + nIns);
    const outputCommitments = publicInputs.slice(2 + nIns, 2 + nIns + nOuts);
    const _chainID = publicInputs[2 + nIns + nOuts];
    const roots = publicInputs.slice(3 + nIns + nOuts, 3 + nIns + nOuts + maxEdges);
    const args = {
      proof: `0x${proof}`,
      roots: `0x${roots.map((x: any) => toFixedHex(x).slice(2)).join('')}`,
      inputNullifiers,
      outputCommitments,
      publicAmount,
      extDataHash,
    };

    return args;
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

  public async generateUTXOInputs(
    inputs: Utxo[],
    outputs: Utxo[],
    chainId: number,
    extAmount: BigNumber,
    fee: BigNumber,
    extDataHash: BigNumber
  ): Promise<any> {
    const vanchorRoots = await this.populateRootsForProof();
    const vanchorMerkleProof = inputs.map((x) => this.getMerkleProof(x));
    const outputCommitment = outputs.map((x) => BigNumber.from(u8aToHex(x.commitment)).toString());

    const vanchorInput: UTXOInputs = await generateVariableWitnessInput(
      vanchorRoots.map((root) => BigNumber.from(root)),
      chainId,
      inputs,
      outputs,
      extAmount,
      fee,
      BigNumber.from(extDataHash),
      vanchorMerkleProof
    );
    const indices = vanchorMerkleProof.map((proof) => proof.forestPathIndices);
    const forestPathIndices: number[] = [];
    indices.forEach((pathIndices) => {
      let index = MerkleTree.calculateIndexFromPathIndices(pathIndices);
      forestPathIndices.push(index);
    });

    const forestPathElements = vanchorMerkleProof.map((proof) =>
      proof.forestPathElements.map((bignum: any) => bignum.toString())
    );

    const proofInput = {
      roots: vanchorInput.roots,
      chainID: vanchorInput.chainID,
      inputNullifier: vanchorInput.inputNullifier,
      outputCommitment: vanchorInput.outputCommitment,
      publicAmount: vanchorInput.publicAmount,
      extDataHash: vanchorInput.extDataHash,
      inAmount: vanchorInput.inAmount,
      inPrivateKey: vanchorInput.inPrivateKey,
      inBlinding: vanchorInput.inBlinding,
      outChainID: vanchorInput.outChainID,
      outAmount: vanchorInput.outAmount,
      outPubkey: vanchorInput.outPubkey,
      outBlinding: vanchorInput.outBlinding,

      subtreePathIndices: vanchorInput.inPathIndices,
      subtreePathElements: vanchorInput.inPathElements.map((utxoPathElements) =>
        utxoPathElements.map((bignum) => bignum.toString())
      ),
      forestPathIndices: forestPathIndices,
      forestPathElements,
    };

    return proofInput;
  }

  public async generateExtData(
    recipient: string,
    extAmount: BigNumber,
    relayer: string,
    fee: BigNumber,
    refund: BigNumber,
    wrapUnwrapToken: string,
    encryptedOutput1: string,
    encryptedOutput2: string
  ): Promise<{ extData: IVariableAnchorExtData; extDataHash: BigNumber }> {
    const extData = {
      recipient: toFixedHex(recipient, 20),
      extAmount: toFixedHex(extAmount),
      relayer: toFixedHex(relayer, 20),
      fee: toFixedHex(fee),
      refund: toFixedHex(refund.toString()),
      token: toFixedHex(wrapUnwrapToken, 20),
      encryptedOutput1,
      encryptedOutput2,
    };

    const extDataHash = await getVAnchorExtDataHash(
      encryptedOutput1,
      encryptedOutput2,
      extAmount.toString(),
      BigNumber.from(fee).toString(),
      recipient,
      relayer,
      refund.toString(),
      wrapUnwrapToken
    );
    return { extData, extDataHash };
  }

  public async updateTreeOrForestState(outputs: Utxo[]): Promise<void> {
    outputs.forEach((x) => {
      const commitment = BigNumber.from(u8aToHex(x.commitment));
      this.tree.insert(commitment.toHexString());
      let numOfElements = this.tree.number_of_elements();
      this.depositHistory[numOfElements - 1] = toFixedHex(this.tree.root().toString());
    });
    const curIdx = await this.contract.currSubtreeIndex();
    const lastSubtreeRoot = await this.contract.getLastSubtreeRoot(0);
    this.forest.update(curIdx, this.tree.root().toHexString());
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
    leavesMap: Record<string, Uint8Array[]> = {}
  ): Promise<SetupTransactionResult> {
    // Default UTXO chain ID will match with the configured signer's chain ID
    inputs = await this.padUtxos(inputs, 16);
    outputs = await this.padUtxos(outputs, 2);

    // first, check if the merkle root is known on chain - if not, then update
    if (wrapUnwrapToken.length === 0) {
      if (!this.token) {
        throw new Error('Token address is not set');
      }

      wrapUnwrapToken = this.token;
    }
    const chainId = getChainIdType(await this.signer.getChainId());
    let extAmount = await this.getExtAmount(inputs, outputs, fee);

    // calculate the sum of input notes (for calculating the public amount)
    let sumInputUtxosAmount: BigNumberish = 0;

    // Pass the identifier for leaves alongside the proof input
    let leafIds: LeafIdentifier[] = [];

    for (const inputUtxo of inputs) {
      sumInputUtxosAmount = BigNumber.from(sumInputUtxosAmount).add(inputUtxo.amount);
      leafIds.push({
        index: inputUtxo.index!, // TODO: remove non-null assertion here
        typedChainId: Number(inputUtxo.originChainId),
      });
    }

    const encryptedCommitments: [Uint8Array, Uint8Array] = [
      hexToU8a(outputs[0].encrypt()),
      hexToU8a(outputs[1].encrypt()),
    ];
    const { extData, extDataHash } = await this.generateExtData(
      recipient,
      BigNumber.from(extAmount),
      relayer,
      BigNumber.from(fee),
      BigNumber.from(refund),
      wrapUnwrapToken,
      outputs[0].encrypt(),
      outputs[1].encrypt()
    );

    const proofInput: UTXOInputs = await this.generateUTXOInputs(
      inputs,
      outputs,
      chainId,
      BigNumber.from(extAmount),
      BigNumber.from(fee),
      extDataHash
    );

    let wasmFile;
    let zkeyFile;
    if (inputs.length > 2) {
      wasmFile = this.largeCircuitZkComponents.wasm;
      zkeyFile = this.largeCircuitZkComponents.zkey;
    } else {
      wasmFile = this.smallCircuitZkComponents.wasm;
      zkeyFile = this.smallCircuitZkComponents.zkey;
    }

    let proof = await groth16.fullProve(proofInput, wasmFile, zkeyFile);

    const publicInputs = await this.generatePublicInputs(proof, inputs.length);
    return {
      extAmount,
      extData,
      publicInputs,
    };
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
    leavesMap: Record<string, Uint8Array[]>,
    overridesTransaction?: OverridesWithFrom<PayableOverrides>
  ): Promise<ethers.ContractReceipt> {
    const { extAmount, extData, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      fee,
      refund,
      recipient,
      relayer,
      wrapUnwrapToken,
      leavesMap
    );

    let options = await this.getWrapUnwrapOptions(extAmount, wrapUnwrapToken);

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
      { ...options, ...overridesTransaction }
    );
    const receipt = await tx.wait();
    // Add the leaves to the tree
    await this.updateTreeOrForestState(outputs);

    return receipt;
  }
}

export default VAnchorForest;
