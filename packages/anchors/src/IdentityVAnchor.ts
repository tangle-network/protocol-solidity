import { BigNumber, BigNumberish, ethers } from 'ethers';
const assert = require('assert');
import {
  IdentityVAnchor as IdentityVAnchorContract,
  IdentityVAnchor__factory,
  IdentityVAnchorEncodeInputs__factory,
} from '@webb-tools/contracts';
import {
  Keypair,
  toFixedHex,
  Utxo,
  MerkleTree,
  median,
  mean,
  max,
  min,
  CircomProvingManager,
  generateVariableWitnessInput,
  getVAnchorExtDataHash,
  MerkleProof,
} from '@webb-tools/sdk-core';
import {
  IVAnchor,
  IIdentityVariableAnchorExtData,
  IIdentityVariableAnchorPublicInputs,
} from '@webb-tools/interfaces';
import {
  u8aToHex,
  getChainIdType,
  UTXOInputs,
  ZkComponents,
  ZERO_BYTES32,
} from '@webb-tools/utils';
import { Semaphore } from '@webb-tools/semaphore';
import { LinkedGroup } from '@webb-tools/semaphore-group';
import { WebbBridge } from './Common';
import { Deployer } from './Deployer';

const snarkjs = require('snarkjs');

const zeroAddress = '0x0000000000000000000000000000000000000000';

export type FullProof = {
  proof: Proof;
  publicSignals: RawPublicSignals;
};

export type Proof = {
  pi_a: string[3];
  pi_b: Array<string[2]>;
  pi_c: string[3];
  protocol: string;
  curve: string;
};
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

export type RawPublicSignals = string[11];

function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}
export var gasBenchmark = [];
export var proofTimeBenchmark = [];
// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods
export class IdentityVAnchor extends WebbBridge implements IVAnchor {
  signer: ethers.Signer;
  contract: IdentityVAnchorContract;
  semaphore: Semaphore;
  tree: MerkleTree;
  group: LinkedGroup;
  // hex string of the connected root
  latestSyncedBlock: number;
  smallCircuitZkComponents: ZkComponents;
  largeCircuitZkComponents: ZkComponents;

  // The depositHistory stores leafIndex => information to create proposals (new root)
  depositHistory: Record<number, string>;
  token?: string;
  denomination?: string;
  maxEdges: number;
  groupId: BigNumber;
  provingManager: CircomProvingManager;

  constructor(
    contract: IdentityVAnchorContract,
    signer: ethers.Signer,
    treeHeight: number,
    maxEdges: number,
    groupId: BigNumber,
    group: LinkedGroup,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents
  ) {
    super(contract, signer);
    this.contract = contract;
    this.signer = signer;
    this.tree = new MerkleTree(treeHeight);
    this.latestSyncedBlock = 0;
    this.maxEdges = maxEdges;
    this.groupId = groupId;
    this.group = group;
    this.depositHistory = {};
    this.smallCircuitZkComponents = smallCircuitZkComponents;
    this.largeCircuitZkComponents = largeCircuitZkComponents;
  }
  getAddress(): string {
    return this.contract.address;
  }
  public static async create2IdentityVAnchor(
    deployer: Deployer,
    saltHex: string,
    semaphore: Semaphore,
    verifier: string,
    levels: number,
    hasher: string,
    handler: string,
    token: string,
    maxEdges: number,
    groupId: BigNumber,
    group: LinkedGroup,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const { contract: encodeLibrary } = await deployer.deploy(
      IdentityVAnchorEncodeInputs__factory,
      saltHex,
      signer
    );
    let libraryAddresses = {
      ['contracts/libs/IdentityVAnchorEncodeInputs.sol:IdentityVAnchorEncodeInputs']:
        encodeLibrary.address,
    };
    const argTypes = [
      'address',
      'address',
      'address',
      'uint8',
      'address',
      'address',
      'uint8',
      'uint256',
    ];
    const args = [
      semaphore.contract.address,
      verifier,
      hasher,
      levels,
      handler,
      token,
      maxEdges,
      groupId,
    ];

    const { contract: vAnchor, receipt } = await deployer.deploy(
      IdentityVAnchor__factory,
      saltHex,
      signer,
      libraryAddresses,
      argTypes,
      args
    );
    const createdIdentityVAnchor = new IdentityVAnchor(
      vAnchor,
      signer,
      BigNumber.from(levels).toNumber(),
      maxEdges,
      groupId,
      group,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdIdentityVAnchor.latestSyncedBlock = receipt.blockNumber!;
    createdIdentityVAnchor.token = token;
    return createdIdentityVAnchor;
  }

  public static async createIdentityVAnchor(
    semaphore: Semaphore,
    verifier: string,
    levels: number,
    hasher: string,
    handler: string,
    token: string,
    maxEdges: number,
    groupId: BigNumber,
    group: LinkedGroup,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const encodeLibraryFactory = new IdentityVAnchorEncodeInputs__factory(signer);
    const encodeLibrary = await encodeLibraryFactory.deploy();
    await encodeLibrary.deployed();
    const factory = new IdentityVAnchor__factory(
      {
        ['contracts/libs/IdentityVAnchorEncodeInputs.sol:IdentityVAnchorEncodeInputs']:
          encodeLibrary.address,
      },
      signer
    );
    const vAnchor = await factory.deploy(
      semaphore.contract.address,
      verifier,
      hasher,
      levels,
      handler,
      token,
      maxEdges,
      groupId
    );
    await vAnchor.deployed();

    const createdIdentityVAnchor = new IdentityVAnchor(
      vAnchor,
      signer,
      BigNumber.from(levels).toNumber(),
      maxEdges,
      groupId,
      group,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdIdentityVAnchor.latestSyncedBlock = vAnchor.deployTransaction.blockNumber!;
    createdIdentityVAnchor.token = token;
    const tx = await createdIdentityVAnchor.contract.initialize(
      BigNumber.from('1'),
      BigNumber.from(2).pow(256).sub(1)
    );
    await tx.wait();
    return createdIdentityVAnchor;
  }

  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    group: LinkedGroup,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const anchor = IdentityVAnchor__factory.connect(address, signer);
    const maxEdges = await anchor.maxEdges();
    const treeHeight = await anchor.outerLevels();
    const groupId = await anchor.groupId();
    const createdAnchor = new IdentityVAnchor(
      anchor,
      signer,
      treeHeight,
      maxEdges,
      groupId,
      group,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdAnchor.token = await anchor.token();
    return createdAnchor;
  }

  public async generateProofCalldata(fullProof: any) {
    // const result = snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const calldata = await snarkjs.groth16.exportSolidityCallData(
      fullProof.proof,
      fullProof.publicSignals
    );
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

  public static convertToPublicInputsStruct(args: any[]): IIdentityVariableAnchorPublicInputs {
    return {
      proof: args[0],
      identityRoots: args[1],
      vanchorRoots: args[2],
      inputNullifiers: args[3],
      outputCommitments: args[4],
      publicAmount: args[5],
      extDataHash: args[6],
    };
  }

  public static convertToExtDataStruct(args: any[]): IIdentityVariableAnchorExtData {
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

  public async populateVAnchorRootsForProof(): Promise<string[]> {
    const neighborEdges = await this.contract.getLatestNeighborEdges();
    const neighborRootInfos = neighborEdges.map((rootData) => {
      return rootData.root;
    });
    let thisRoot = await this.contract.getLastRoot();
    return [thisRoot.toString(), ...neighborRootInfos.map((bignum) => bignum.toString())];
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
    byte_calldata: any,
    nIns: number = 2,
    nOuts: number = 2,
    numSemaphoreRoots: number = 2,
    numVAnchorRoots: number = 2
  ): IIdentityVariableAnchorPublicInputs {
    // public inputs to the contract
    const publicInputs = JSON.parse('[' + byte_calldata + ']')[3];

    let index = 0;
    const identityRoots = publicInputs.slice(index, numSemaphoreRoots);
    index = numSemaphoreRoots + 1; // ignoring public chainID from circuit

    const publicAmount = publicInputs[index++];
    const extDataHash = publicInputs[index++];

    const inputs = publicInputs.slice(index, index + nIns);
    index += nIns;

    const outputs = publicInputs.slice(index, index + nOuts);
    index += nOuts;

    const vanchorRoots = publicInputs.slice(index, index + numVAnchorRoots);
    const args: IIdentityVariableAnchorPublicInputs = {
      proof: `0x${proof}`,
      identityRoots: `0x${identityRoots.map((x) => toFixedHex(x).slice(2)).join('')}`,
      vanchorRoots: `0x${vanchorRoots.map((x) => toFixedHex(x).slice(2)).join('')}`,
      inputNullifiers: inputs.map((x) => toFixedHex(x)),
      outputCommitments: [toFixedHex(outputs[0]), toFixedHex(outputs[1])],
      publicAmount: toFixedHex(publicAmount),
      extDataHash: toFixedHex(extDataHash),
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
  public async getProposalData(resourceID: string, leafIndex?: number): Promise<string> {
    // If no leaf index passed in, set it to the most recent one.
    if (!leafIndex) {
      leafIndex = this.tree.number_of_elements() - 1;
    }

    const chainID = getChainIdType(await this.signer.getChainId());
    const merkleRoot = this.depositHistory[leafIndex];
    return this.genProposalData(resourceID, merkleRoot, leafIndex);
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
  public async generateProof(
    keypair: Keypair,
    identityRoots: string[],
    identityMerkleProof: MerkleProof,
    outSemaphoreProofs: MerkleProof[],
    extDataHash: string,
    vanchorInputs: UTXOInputs
  ): Promise<FullProof> {
    // ): Promise<{proof: > {
    const proofInputs = {
      privateKey: keypair.privkey.toString(),
      semaphoreTreePathIndices: identityMerkleProof.pathIndices,
      semaphoreTreeSiblings: identityMerkleProof.pathElements.map((x) =>
        BigNumber.from(x).toString()
      ),
      semaphoreRoots: identityRoots,
      chainID: vanchorInputs.chainID,
      publicAmount: vanchorInputs.publicAmount,
      extDataHash: extDataHash,

      // data for 2 transaction inputs
      inputNullifier: vanchorInputs.inputNullifier,
      inAmount: vanchorInputs.inAmount,
      inPrivateKey: vanchorInputs.inPrivateKey,
      inBlinding: vanchorInputs.inBlinding,
      inPathIndices: vanchorInputs.inPathIndices,
      inPathElements: vanchorInputs.inPathElements.map((utxoPathElements) =>
        utxoPathElements.map((x) => BigNumber.from(x).toString())
      ),

      // data for 2 transaction outputs
      outputCommitment: vanchorInputs.outputCommitment,
      outChainID: vanchorInputs.outChainID,
      outAmount: vanchorInputs.outAmount,
      outPubkey: vanchorInputs.outPubkey,
      outSemaphoreTreePathIndices: outSemaphoreProofs.map((proof) =>
        proof.pathIndices.map((idx) => BigNumber.from(idx).toString())
      ),
      outSemaphoreTreeElements: outSemaphoreProofs.map((proof) =>
        proof.pathElements.map((elem) => {
          if (BigNumber.isBigNumber(elem)) {
            return elem.toString();
          }
          return BigNumber.from(elem).toString();
        })
      ),
      outBlinding: vanchorInputs.outBlinding,
      vanchorRoots: vanchorInputs.roots,
    };

    let proof = await snarkjs.groth16.fullProve(
      proofInputs,
      this.smallCircuitZkComponents.wasm,
      this.smallCircuitZkComponents.zkey
    );
    return proof;
  }

  public async setupTransaction(
    keypair: Keypair,
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string
  ) {
    if (wrapUnwrapToken.length === 0) {
      wrapUnwrapToken = this.token;
    }

    const chainId = getChainIdType(await this.signer.getChainId());
    const identityRootInputs = this.populateIdentityRootsForProof();
    const identityMerkleProof: MerkleProof = this.generateIdentityMerkleProof(keypair.getPubKey());
    const vanchorMerkleProof = inputs.map((x) => this.getMerkleProof(x));
    let extAmount = this.getExtAmount(inputs, outputs, fee);

    const { extData, extDataHash } = await this.generateExtData(
      recipient,
      extAmount,
      relayer,
      BigNumber.from(fee),
      BigNumber.from(refund),
      wrapUnwrapToken,
      outputs[0].encrypt(),
      outputs[1].encrypt()
    );

    const vanchorInput: UTXOInputs = await this.generateUTXOInputs(
      inputs,
      outputs,
      chainId,
      extAmount,
      BigNumber.from(fee),
      extDataHash
    );

    const outSemaphoreProofs = this.generateOutputSemaphoreProof(outputs);
    const fullProof = await this.generateProof(
      keypair,
      identityRootInputs,
      identityMerkleProof,
      outSemaphoreProofs,
      extDataHash.toString(),
      vanchorInput
    );
    const proof = await this.generateProofCalldata(fullProof);
    const vKey = await snarkjs.zKey.exportVerificationKey(this.smallCircuitZkComponents.zkey);
    const calldata = await snarkjs.groth16.exportSolidityCallData(
      fullProof.proof,
      fullProof.publicSignals
    );

    const publicInputs: IIdentityVariableAnchorPublicInputs = this.generatePublicInputs(
      proof,
      calldata
    );

    const is_valid: boolean = await snarkjs.groth16.verify(
      vKey,
      fullProof.publicSignals,
      fullProof.proof
    );
    assert.strictEqual(is_valid, true);

    return { extAmount, extData, publicInputs };
  }

  public generateIdentityMerkleProof(pubkey: string): MerkleProof {
    const idx = this.group.indexOf(pubkey);
    const identityMerkleProof: MerkleProof = this.group.generateProofOfMembership(idx);
    return identityMerkleProof;
  }
  public populateIdentityRootsForProof(): string[] {
    return this.group.getRoots().map((bignum: BigNumber) => bignum.toString());
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

  public generateOutputSemaphoreProof(outputs: Utxo[]): MerkleProof[] {
    const outSemaphoreProofs = outputs.map((utxo) => {
      const leaf = utxo.keypair.getPubKey();
      if (Number(utxo.amount) > 0) {
        const idx = this.group.indexOf(leaf);
        return this.group.generateProofOfMembership(idx);
      } else {
        const inputMerklePathIndices = new Array(this.group.depth).fill(0);
        const inputMerklePathElements = new Array(this.group.depth).fill(0);

        return {
          pathIndices: inputMerklePathIndices,
          pathElements: inputMerklePathElements,
          element: BigNumber.from(0),
          merkleRoot: BigNumber.from(0),
        };
      }
    });
    return outSemaphoreProofs;
  }

  public async generateUTXOInputs(
    inputs: Utxo[],
    outputs: Utxo[],
    chainId: number,
    extAmount: BigNumber,
    fee: BigNumber,
    extDataHash: BigNumber
  ): Promise<UTXOInputs> {
    const vanchorRoots = await this.populateVAnchorRootsForProof();
    const vanchorMerkleProof = inputs.map((x) => this.getMerkleProof(x));

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

    return vanchorInput;
  }
  public updateTreeState(outputs: Utxo[]): void {
    outputs.forEach((x) => {
      this.tree.insert(u8aToHex(x.commitment));
      let numOfElements = this.tree.number_of_elements();
      this.depositHistory[numOfElements - 1] = toFixedHex(this.tree.root().toString());
    });
  }

  public async transact(
    keypair: Keypair,
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string
  ): Promise<ethers.ContractTransaction> {
    inputs = await this.padUtxos(inputs, 16);
    outputs = await this.padUtxos(outputs, 2);

    const { extAmount, extData, publicInputs } = await this.setupTransaction(
      keypair,
      inputs,
      outputs,
      fee,
      refund,
      recipient,
      relayer,
      wrapUnwrapToken
    );
    let options = await this.getWrapUnwrapOptions(extAmount, wrapUnwrapToken);

    let tx = await this.contract.transact(
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
        roots: publicInputs.vanchorRoots,
        extensionRoots: publicInputs.identityRoots,
        inputNullifiers: publicInputs.inputNullifiers,
        outputCommitments: [publicInputs.outputCommitments[0], publicInputs.outputCommitments[1]],
        publicAmount: publicInputs.publicAmount,
        extDataHash: publicInputs.extDataHash,
      },
      extData,
      options
    );
    const receipt = await tx.wait();

    // Add the leaves to the tree
    this.updateTreeState(outputs);

    return tx;
  }
}

export default IdentityVAnchor;
