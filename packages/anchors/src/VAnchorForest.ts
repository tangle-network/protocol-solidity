import { BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import {
  VAnchorForest as VAnchorForestContract,
  VAnchorForest__factory,
  VAnchorEncodeInputs__factory,
  LinkableIncrementalBinaryTree__factory,
  TokenWrapper__factory,
} from '@webb-tools/contracts';
import { poseidon, poseidon_gencontract as poseidonContract } from 'circomlibjs';
import { zKey, groth16 } from 'snarkjs';
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
  getVAnchorExtDataHash,
  CircomProvingManager,
  ProvingManagerSetupInput,
  generateVariableWitnessInput,
  Note,
  NoteGenInput,
  MerkleProof,
  UtxoGenInput,
  CircomUtxo,
  FIELD_SIZE,
  LeafIdentifier,
} from '@webb-tools/sdk-core';

// import { MerkleTree } from "."
import {
  IVAnchor,
  IVariableAnchorExtData,
  IVariableAnchorPublicInputs,
} from '@webb-tools/interfaces';
import {
  hexToU8a,
  UTXOInputs,
  u8aToHex,
  getChainIdType,
  ZkComponents,
  ZERO_BYTES32,
} from '@webb-tools/utils';
import { solidityPack } from 'ethers/lib/utils';

const zeroAddress = '0x0000000000000000000000000000000000000000';
function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}
export type ExtData = {
  recipient: string;
  extAmount: string;
  relayer: string;
  fee: string;
  refund: string;
  token: string;
  encryptedOutput1: string;
  encryptedOutput2: string;
};

export var gasBenchmark = [];
export var proofTimeBenchmark = [];
// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods
export class VAnchorForest {
  signer: ethers.Signer;
  contract: VAnchorForestContract;
  forest: MerkleTree;
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
    contract: VAnchorForestContract,
    signer: ethers.Signer,
    forestHeight: number,
    treeHeight: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents
  ) {
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

  getAddress(): string {
    return this.contract.address;
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

  public static async generateUTXO(input: UtxoGenInput): Promise<Utxo> {
    return CircomUtxo.generateUtxo(input);
  }

  public static createRootsBytes(rootArray: string[]) {
    let rootsBytes = '0x';
    for (let i = 0; i < rootArray.length; i++) {
      rootsBytes += toFixedHex(rootArray[i]).substr(2);
    }
    return rootsBytes; // root byte string (32 * array.length bytes)
  }

  // Convert a hex string to a byte array
  public static hexStringToByte(str: string) {
    if (!str) {
      return new Uint8Array();
    }

    var a = [];
    for (var i = 0, len = str.length; i < len; i += 2) {
      a.push(parseInt(str.substr(i, 2), 16));
    }

    return new Uint8Array(a);
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

  public async createResourceId(): Promise<string> {
    return toHex(
      this.contract.address + toHex(getChainIdType(await this.signer.getChainId()), 6).substr(2),
      32
    );
  }

  public async setVerifier(verifierAddress: string) {
    const tx = await this.contract.setVerifier(
      verifierAddress,
      BigNumber.from(await this.contract.getProposalNonce()).add(1)
    );
    await tx.wait();
  }

  public async setHandler(handlerAddress: string) {
    const tx = await this.contract.setHandler(
      handlerAddress,
      BigNumber.from(await this.contract.getProposalNonce()).add(1)
    );
    await tx.wait();
  }

  public async setSigner(newSigner: ethers.Signer) {
    const currentChainId = await this.signer.getChainId();
    const newChainId = await newSigner.getChainId();

    if (currentChainId === newChainId) {
      this.signer = newSigner;
      this.contract = this.contract.connect(newSigner);
      return true;
    }
    return false;
  }

  // Proposal data is used to update linkedAnchors via bridge proposals
  // on other chains with this anchor's state
  public async getProposalData(resourceID: string, leafIndex?: number): Promise<string> {
    // If no leaf index passed in, set it to the most recent one.
    if (!leafIndex) {
      leafIndex = this.tree.number_of_elements() - 1;
    }

    const chainID = getChainIdType(await this.signer.getChainId());
    const merkleRoot = this.depositHistory[leafIndex];
    const functionSig = ethers.utils
      .keccak256(ethers.utils.toUtf8Bytes('updateEdge(bytes32,uint32,bytes32)'))
      .slice(0, 10)
      .padEnd(10, '0');

    const srcContract = this.contract.address;
    const srcResourceId =
      '0x' +
      toHex(0, 6).substring(2) +
      toHex(srcContract, 20).substr(2) +
      toHex(chainID, 6).substr(2);
    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(leafIndex, 4).substr(2) +
      toHex(merkleRoot, 32).substr(2) +
      toHex(srcResourceId, 32).substr(2)
    );
  }

  public async getHandler(): Promise<string> {
    return this.contract.handler();
  }

  public async getHandlerProposalData(newHandler: string): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = ethers.utils
      .keccak256(ethers.utils.toUtf8Bytes('setHandler(address,uint32)'))
      .slice(0, 10)
      .padEnd(10, '0');
    const nonce = Number(await this.contract.getProposalNonce()) + 1;

    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) +
      toHex(newHandler, 20).substr(2)
    );
  }

  public async getMinWithdrawalLimitProposalData(
    _minimalWithdrawalAmount: string
  ): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = ethers.utils
      .keccak256(ethers.utils.toUtf8Bytes('configureMinimalWithdrawalLimit(uint256,uint32)'))
      .slice(0, 10)
      .padEnd(10, '0');
    const nonce = Number(await this.contract.getProposalNonce()) + 1;
    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) +
      toFixedHex(_minimalWithdrawalAmount).substr(2)
    );
  }

  public async getMaxDepositLimitProposalData(_maximumDepositAmount: string): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = ethers.utils
      .keccak256(ethers.utils.toUtf8Bytes('configureMaximumDepositLimit(uint256,uint32)'))
      .slice(0, 10)
      .padEnd(10, '0');
    const nonce = Number(await this.contract.getProposalNonce()) + 1;
    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) +
      toFixedHex(_maximumDepositAmount).substr(2)
    );
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
  public getMerkleProof(input: Utxo): any {
    let inputSubtreePathIndices: number[];
    let inputSubtreePathElements: BigNumber[];
    let inputForestPathIndices: number[];
    let inputForestPathElements: BigNumber[];

    if (Number(input.amount) > 0) {
      if (input.index < 0) {
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
      roots: `0x${roots.map((x) => toFixedHex(x).slice(2)).join('')}`,
      // inputNullifiers: `0x${roots.map((x) => toFixedHex(x).slice(2)).join('')}`,
      inputNullifiers,
      outputCommitments,
      publicAmount,
      extDataHash,
      // outputCommitments: [
      //   toFixedHex(u8aToHex(outputs[0].commitment)),
      //   toFixedHex(u8aToHex(outputs[1].commitment)),
      // ],
      // publicAmount: toFixedHex(publicAmount),
      // extDataHash: toFixedHex(extDataHash),
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
    const forestPathIndices = [];
    indices.forEach((pathIndices) => {
      let index = MerkleTree.calculateIndexFromPathIndices(pathIndices);
      forestPathIndices.push(index);
    });

    const forestPathElements = vanchorMerkleProof.map((proof) =>
      proof.forestPathElements.map((bignum) => bignum.toString())
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
  ): Promise<{ extData: ExtData; extDataHash: BigNumber }> {
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

  public async updateForest(outputs: Utxo[]): Promise<void> {
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
    outputs: [Utxo, Utxo],
    extAmount: BigNumberish,
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    leavesMap: Record<string, Uint8Array[]>
  ) {
    // first, check if the merkle root is known on chain - if not, then update
    const chainId = getChainIdType(await this.signer.getChainId());

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
      extData,
      publicInputs,
    };
  }

  public async encodeSolidityProof(fullProof: any, calldata: any): Promise<String> {
    const proof = JSON.parse('[' + calldata + ']');
    const pi_a = proof[0];
    const pi_b = proof[1];
    const pi_c = proof[2];

    const proofEncoded = [
      pi_a[0],
      pi_a[1],
      pi_b[0][0],
      pi_b[0][1],
      pi_b[1][0],
      pi_b[1][1],
      pi_c[0],
      pi_c[1],
    ]
      .map((elt) => elt.substr(2))
      .join('');

    return proofEncoded;
  }

  public async padUtxos(utxos: Utxo[], maxLength: number): Promise<Utxo[]> {
    const evmId = await this.signer.getChainId();
    const chainId = getChainIdType(evmId);
    const randomKeypair = new Keypair();
    while (utxos.length !== 2 && utxos.length < maxLength) {
      utxos.push(
        await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainId.toString(),
          originChainId: chainId.toString(),
          blinding: hexToU8a(randomBN(31).toHexString()),
          amount: '0',
          keypair: randomKeypair,
        })
      );
    }
    return utxos;
  }

  public async padInputsAndOutputs(
    inputs: Utxo[],
    outputs: Utxo[]
  ): Promise<{ inputs: Utxo[]; outputs: Utxo[] }> {
    inputs = await this.padUtxos(inputs, 16);
    outputs = await this.padUtxos(outputs, 2);
    return { inputs, outputs };
  }
  public async getExtAmount(inputs: Utxo[], outputs: Utxo[], fee: BigNumberish) {
    return BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(BigNumber.from(BigInt(x.amount))), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(BigNumber.from(BigInt(x.amount))), BigNumber.from(0)));
  }
  public async registerAndTransact(
    owner: string,
    keyData: string,
    raw_inputs: Utxo[],
    raw_outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    leavesMap: Record<string, Uint8Array[]>
  ): Promise<ethers.ContractReceipt> {
    let { inputs, outputs } = await this.padInputsAndOutputs(raw_inputs, raw_outputs);
    let extAmount = await this.getExtAmount(inputs, outputs, fee);

    if (wrapUnwrapToken.length === 0) {
      wrapUnwrapToken = this.token;
    }

    const { extData, publicInputs } = await this.setupTransaction(
      inputs,
      [outputs[0], outputs[1]],
      extAmount,
      fee,
      refund,
      recipient,
      relayer,
      wrapUnwrapToken,
      leavesMap
    );

    let options = {};
    if (extAmount.gt(0) && checkNativeAddress(wrapUnwrapToken)) {
      let tokenWrapper = TokenWrapper__factory.connect(await this.contract.token(), this.signer);
      let valueToSend = await tokenWrapper.getAmountToWrap(extAmount);

      options = {
        value: valueToSend.toHexString(),
        gasLimit: '0x5B8D80',
      };
    } else {
      options = {
        gasLimit: '0x5B8D80',
      };
    }

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
    await this.updateForest(outputs);

    return receipt;
  }

  public async transact(
    raw_inputs: Utxo[],
    raw_outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    leavesMap: Record<string, Uint8Array[]>
  ): Promise<ethers.ContractReceipt> {
    // Validate input utxos have a valid originChainId
    raw_inputs.map((utxo) => {
      if (utxo.originChainId === undefined) {
        throw new Error('Input Utxo does not have a configured originChainId');
      }
    });

    // Default UTXO chain ID will match with the configured signer's chain ID
    let { inputs, outputs } = await this.padInputsAndOutputs(raw_inputs, raw_outputs);

    let extAmount = await this.getExtAmount(inputs, outputs, fee);

    if (wrapUnwrapToken.length === 0) {
      wrapUnwrapToken = this.token;
    }

    const { extData, publicInputs } = await this.setupTransaction(
      inputs,
      [outputs[0], outputs[1]],
      extAmount,
      fee,
      refund,
      recipient,
      relayer,
      wrapUnwrapToken,
      leavesMap
    );

    let options = {};
    if (extAmount.gt(0) && checkNativeAddress(wrapUnwrapToken)) {
      let tokenWrapper = TokenWrapper__factory.connect(await this.contract.token(), this.signer);
      let valueToSend = await tokenWrapper.getAmountToWrap(extAmount);

      options = {
        value: valueToSend.toHexString(),
        gasLimit: '0x5B8D80',
      };
    } else {
      options = {
        gasLimit: '0x5B8D80',
      };
    }

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
        extensionRoots: [],
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

    await this.updateForest(outputs);

    return receipt;
  }
}

export default VAnchorForest;
