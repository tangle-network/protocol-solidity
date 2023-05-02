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
  toFixedHex,
} from '@webb-tools/sdk-core';
import { poseidon_gencontract as poseidonContract } from 'circomlibjs';
import { BigNumber, BigNumberish, PayableOverrides, ethers } from 'ethers';
import { IVariableAnchorPublicInputs } from '@webb-tools/interfaces';
import {
  VAnchorProofInputs,
  ZERO_BYTES32,
  ZkComponents,
  getChainIdType,
  u8aToHex,
} from '@webb-tools/utils';
import { WebbBridge, WebbContracts } from './Common';
import { Deployer } from '@webb-tools/create2-utils';
import { groth16 } from 'snarkjs';

import { OverridesWithFrom, SetupTransactionResult, TransactionOptions } from './types';
import { splitTransactionOptions } from './utils';

export class VAnchorForest extends WebbBridge<WebbContracts> {
  contract: VAnchorForestContract;
  forest: MerkleTree;

  forestHeight: number;
  maxEdges: number;
  latestSyncedBlock: number;
  smallCircuitZkComponents: ZkComponents;
  largeCircuitZkComponents: ZkComponents;

  token?: string;
  provingManager: CircomProvingManager;

  gasBenchmark = [];
  proofTimeBenchmark = [];

  constructor(
    contract: VAnchorForestContract,
    signer: ethers.Signer,
    forestHeight: number,
    treeHeight: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents
  ) {
    super(contract, signer, treeHeight);
    this.signer = signer;
    this.contract = contract;
    this.forest = new MerkleTree(forestHeight);
    this.tree = new MerkleTree(treeHeight);
    this.latestSyncedBlock = 0;
    this.forestHeight = forestHeight;
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
  public getMerkleProof(
    input: Utxo,
    treeLeavesMap?: Uint8Array[],
    forestLeavesMap?: Uint8Array[]
  ): any {
    let inputSubtreePathIndices: number[];
    let inputSubtreePathElements: BigNumber[];
    let inputForestPathIndices: number[];
    let inputForestPathElements: BigNumber[];

    if (Number(input.amount) > 0) {
      if (input.index === undefined) {
        throw new Error(`Input commitment ${u8aToHex(input.commitment)} index was not set`);
      }
      if (input.index < 0) {
        throw new Error(`Input commitment ${u8aToHex(input.commitment)} index should be >= 0`);
      }
      if (treeLeavesMap === undefined) {
        const subtreePath = this.tree.path(input.index);
        const idx = this.forest.indexOf(subtreePath.merkleRoot.toString());
        const forestPath = this.forest.path(idx);
        inputSubtreePathIndices = subtreePath.pathIndices;
        inputSubtreePathElements = subtreePath.pathElements;
        inputForestPathIndices = forestPath.pathIndices;
        inputForestPathElements = forestPath.pathElements;
      } else {
        const subTree = new MerkleTree(this.treeHeight, treeLeavesMap);
        const subtreePath = subTree.path(input.index);

        const forest = new MerkleTree(this.forestHeight, forestLeavesMap);
        const idx = forest.indexOf(subtreePath.merkleRoot.toString());

        const forestPath = forest.path(idx);
        inputSubtreePathIndices = subtreePath.pathIndices;
        inputSubtreePathElements = subtreePath.pathElements;
        inputForestPathIndices = forestPath.pathIndices;
        inputForestPathElements = forestPath.pathElements;
      }
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
    proof = await this.encodeSolidityProof(byte_calldata);
    const publicInputs = JSON.parse('[' + byte_calldata + ']')[3];

    const publicAmount = publicInputs[0];
    const extDataHash = publicInputs[1];
    const inputNullifiers = publicInputs.slice(2, 2 + nIns);
    const outputCommitments = publicInputs.slice(2 + nIns, 2 + nIns + nOuts);
    // const _chainID = publicInputs[2 + nIns + nOuts];
    const roots = publicInputs.slice(3 + nIns + nOuts, 3 + nIns + nOuts + maxEdges);
    const args = {
      proof: `0x${proof}`,
      roots: `0x${roots.map((x: any) => toFixedHex(x).slice(2)).join('')}`,
      inputNullifiers,
      outputCommitments,
      publicAmount,
      extensionRoots: [],
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
  public async setWithLeaves(
    subtreeLeaves: string[],
    forestLeaves: string[],
    syncedBlock?: number
  ): Promise<Boolean> {
    let newSubtree = new MerkleTree(this.tree.levels, subtreeLeaves);
    let newForest = new MerkleTree(this.forest.levels, forestLeaves);
    let root = toFixedHex(newForest.root());
    let validTree = await this.contract.isKnownRoot(root);

    if (validTree) {
      let index = 0;
      for (const leaf of newForest.elements()) {
        this.depositHistory[index] = toFixedHex(this.tree.root());
        index++;
      }
      if (!syncedBlock) {
        if (!this.signer.provider) {
          throw new Error('Signer does not have a provider');
        }

        syncedBlock = await this.signer.provider.getBlockNumber();
      }
      // this.forest = new MerkleTree(this.forestHeight);
      // this.tree = new MerkleTree(this.treeHeight);
      this.forest = newForest;
      this.tree = newSubtree;
      this.latestSyncedBlock = syncedBlock;
      return true;
    } else {
      return false;
    }
  }
  public async generateVAnchorProofInputs(
    inputs: Utxo[],
    outputs: Utxo[],
    chainId: number,
    extAmount: BigNumber,
    fee: BigNumber,
    extDataHash: BigNumber,
    leavesMap: Record<string, Uint8Array[]>, // subtree leaves
    txOptions: TransactionOptions
  ): Promise<any> {
    const vanchorRoots = await this.populateRootsForProof();
    let vanchorMerkleProof: any;
    if (Object.keys(leavesMap).length === 0) {
      vanchorMerkleProof = inputs.map((x) => this.getMerkleProof(x));
    } else {
      const treeChainId: string | undefined = txOptions.treeChainId;
      if (treeChainId === undefined) {
        throw new Error(
          'Need to specify chainId on txOptions in order to generate merkleProof correctly'
        );
      }
      const treeElements: Uint8Array[] = leavesMap[treeChainId];
      const forestElements: Uint8Array[] | undefined = txOptions.externalLeaves;
      if (forestElements === undefined) {
        throw new Error(
          'Need to specify forestElements on txOptions in order to generate merkleProof correctly'
        );
      }
      vanchorMerkleProof = inputs.map((x) => this.getMerkleProof(x, treeElements, forestElements));
    }
    const vanchorInput: VAnchorProofInputs = await generateVariableWitnessInput(
      vanchorRoots.map((root) => BigNumber.from(root)),
      chainId,
      inputs,
      outputs,
      extAmount,
      fee,
      BigNumber.from(extDataHash),
      vanchorMerkleProof
    );
    const indices = vanchorMerkleProof.map((proof: any) => proof.forestPathIndices);
    const forestPathIndices: number[] = [];
    indices.forEach((pathIndices: number[]) => {
      let index = MerkleTree.calculateIndexFromPathIndices(pathIndices);
      forestPathIndices.push(index);
    });

    const forestPathElements = vanchorMerkleProof.map((proof: any) =>
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
      subtreePathElements: vanchorInput.inPathElements.map((utxoPathElements: any) =>
        utxoPathElements.map((el: any) => el.toString())
      ),
      forestPathIndices,
      forestPathElements,
    };

    return proofInput;
  }

  public async updateTreeOrForestState(outputs: Utxo[]): Promise<void> {
    outputs.forEach((x) => {
      const commitment = BigNumber.from(u8aToHex(x.commitment));
      this.tree.insert(commitment.toHexString());
      let numOfElements = this.tree.number_of_elements();
      this.depositHistory[numOfElements - 1] = toFixedHex(this.tree.root().toString());
    });
    const curIdx = await this.contract.currSubtreeIndex();
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
    leavesMap: Record<string, Uint8Array[]>,
    txOptions: TransactionOptions
  ): Promise<SetupTransactionResult> {
    if (wrapUnwrapToken.length === 0) {
      if (!this.token) {
        throw new Error('Token address is not set');
      }

      wrapUnwrapToken = this.token;
    }
    const chainId = getChainIdType(await this.signer.getChainId());
    let extAmount = this.getExtAmount(inputs, outputs, fee);

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
    const proofInput: VAnchorProofInputs = await this.generateVAnchorProofInputs(
      inputs,
      outputs,
      chainId,
      BigNumber.from(extAmount),
      BigNumber.from(fee),
      BigNumber.from(extDataHash),
      leavesMap,
      txOptions
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
    overridesTransaction?: OverridesWithFrom<PayableOverrides> & TransactionOptions
  ): Promise<ethers.ContractReceipt> {
    const [overrides, txOptions] = splitTransactionOptions(overridesTransaction);

    // Default UTXO chain ID will match with the configured signer's chain ID
    inputs = await this.padUtxos(inputs, 16);
    outputs = await this.padUtxos(outputs, 2);

    const { extAmount, extData, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      fee,
      refund,
      recipient,
      relayer,
      wrapUnwrapToken,
      leavesMap,
      txOptions
    );

    let options = await this.getWrapUnwrapOptions(
      extAmount,
      BigNumber.from(refund),
      wrapUnwrapToken
    );

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
      { ...options, ...overrides }
    );
    const receipt = await tx.wait();
    // Add the leaves to the tree
    await this.updateTreeOrForestState(outputs);

    return receipt;
  }
}

export default VAnchorForest;
