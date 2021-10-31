import { BigNumber, BigNumberish, ethers } from "ethers";
import { VAnchor__factory } from '../../typechain/factories/VAnchor__factory';
import { VAnchor as VAnchorContract} from '../../typechain/VAnchor';
import { rbigint, p256 } from "../bridge/utils";
import { toFixedHex, toHex } from '../../lib/bridge/utils';
import PoseidonHasher from '../bridge/Poseidon';
import { MerkleTree } from './MerkleTree';
import MintableToken from "../bridge/MintableToken";
import { RootInfo } from ".";
import { FIELD_SIZE, getExtDataHash, poseidonHash2, randomBN, shuffle } from "./utils";
import { Utxo } from './utxo';
import { Keypair } from "./keypair";

const path = require('path');
const snarkjs = require('snarkjs');
const F = require('circomlibjs').babyjub.F;
const Scalar = require('ffjavascript').Scalar;

export interface IVerifiers {
  verifier2: string;
  verifier16: string;
}

export interface IPermissionedAccounts {
  bridge: string;
  admin: string;
  handler: string;
}

export interface IMerkleProofData {
  pathElements: BigNumberish[],
  pathIndex: BigNumberish,
  merkleRoot: BigNumberish;
}

export interface IUTXOInputs {
  chainId?: BigNumber;
  amount?: BigNumber;
  keypair?: Keypair;
  blinding?: BigNumber;
  index?: BigNumber;
}

export interface IPublicInputs {
  proof: string;
  roots: string;
  inputNullifiers: string[];
  outputCommitments: string[];
  publicAmount: string;
  extDataHash: string;
}

export interface IExtData {
  recipient: string;
  extAmount: string;
  relayer: string;
  fee: string;
  encryptedOutput1: string;
  encryptedOutput2: string;
  isL1Withdrawal: boolean;
}

export interface IWitnessInput {
  input: {
    roots: BigNumberish[],
    diffs: BigNumberish[][],
    chainId: BigNumberish,
    inputNullifier: BigNumberish[],
    outputCommitment: BigNumberish[],
    publicAmount: BigNumberish,
    extDataHash: BigNumberish,

    // data for 2 transaction inputs
    inAmount: BigNumberish[],
    inPrivateKey: string[],
    inBlinding: BigNumberish[],
    inPathIndices: BigNumberish[],
    inPathElements: BigNumberish[][],

    // data for 2 transaction outputs
    outChainID: BigNumberish[],
    outAmount: BigNumberish[],
    outBlinding: BigNumberish[],
    outPubkey: BigNumberish[],
  };
  extData: IExtData
}

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods 
class VAnchor {
  signer: ethers.Signer;
  contract: VAnchorContract;
  tree: MerkleTree;
  // hex string of the connected root
  latestSyncedBlock: number;
  circuitZkeyPath: string;
  circuitWASMPath: string;

  // The depositHistory stores leafIndex => information to create proposals (new root)
  depositHistory: Record<number, string>;
  token?: string;
  denomination?: string;
  witnessCalculator: any;

  private constructor(
    contract: VAnchorContract,
    signer: ethers.Signer,
    treeHeight: number,
    maxEdges: number,
  ) {
    this.signer = signer;
    this.contract = contract;
    this.tree = new MerkleTree(treeHeight, [], { hashFunction: poseidonHash2 });
    this.latestSyncedBlock = 0;
    this.depositHistory = {};
    this.witnessCalculator = {};

    // set the circuit zkey and wasm depending upon max edges
    switch (maxEdges) {
      case 1:
        this.circuitWASMPath = 'test/fixtures/bridge/2/poseidon_bridge_2.wasm';
        this.circuitZkeyPath = 'test/fixtures/bridge/2/circuit_final.zkey';
        this.witnessCalculator = require("../../test/fixtures/bridge/2/witness_calculator.js");
        break;
      case 2:
        this.circuitWASMPath = 'test/fixtures/bridge/3/poseidon_bridge_3.wasm';
        this.circuitZkeyPath = 'test/fixtures/bridge/3/circuit_final.zkey';
        this.witnessCalculator = require("../../test/fixtures/bridge/3/witness_calculator.js");
        break;
      case 3:
        this.circuitWASMPath = 'test/fixtures/bridge/4/poseidon_bridge_4.wasm';
        this.circuitZkeyPath = 'test/fixtures/bridge/4/circuit_final.zkey';
        this.witnessCalculator = require("../../test/fixtures/bridge/4/witness_calculator.js");
        break;
      case 4:
        this.circuitWASMPath = 'test/fixtures/bridge/5/poseidon_bridge_5.wasm';
        this.circuitZkeyPath = 'test/fixtures/bridge/5/circuit_final.zkey';
        this.witnessCalculator = require("../../test/fixtures/bridge/5/witness_calculator.js");
        break;
      case 5:
        this.circuitWASMPath = 'test/fixtures/bridge/6/poseidon_bridge_6.wasm';
        this.circuitZkeyPath = 'test/fixtures/bridge/6/circuit_final.zkey';
        this.witnessCalculator = require("../../test/fixtures/bridge/6/witness_calculator.js");
        break;
      default:
        this.circuitWASMPath = 'test/fixtures/bridge/2/poseidon_bridge_2.wasm';
        this.circuitZkeyPath = 'test/fixtures/bridge/2/circuit_final.zkey';
        this.witnessCalculator = require("../../test/fixtures/bridge/2/witness_calculator.js");
        break;
    }

  }

  // public static anchorFromAddress(
  //   contract: string,
  //   signer: ethers.Signer,
  // ) {
  //   const anchor = VAnchor__factory.connect(contract, signer);
  //   return new Anchor(anchor, signer);
  // }

  // Deploys an Anchor contract and sets the signer for deposit and withdraws on this contract.
/*
    Verifiers memory _verifiers,
    uint32 _levels,
    address _hasher,
    IERC6777 _token,
    address _omniBridge,
    address _l1Unwrapper,
    uint256 _l1ChainId,
    PermissionedAccounts memory _permissions,
    uint8 _maxEdges
*/

  public static async createVAnchor(
    verifiers: IVerifiers,
    levels: BigNumberish,
    hasher: string,
    token: string,
    omniBridge: string,
    l1Unwrapper: string,
    l1ChainId: BigNumberish,
    permissions: IPermissionedAccounts,
    maxEdges: number,
    signer: ethers.Signer,
  ) {
    const factory = new VAnchor__factory(signer);
    const vAnchor = await factory.deploy(verifiers, levels, hasher, token, omniBridge, l1Unwrapper, l1ChainId, permissions, maxEdges, {});
    await vAnchor.deployed();
    const createdVAnchor = new VAnchor(vAnchor, signer, BigNumber.from(levels).toNumber(), maxEdges);
    createdVAnchor.latestSyncedBlock = vAnchor.deployTransaction.blockNumber!;
    createdVAnchor.token = token;
    return createdVAnchor;
  }

  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    signer: ethers.Signer,
  ) {
    const anchor = VAnchor__factory.connect(address, signer);
    const maxEdges = await anchor.maxEdges()
    const treeHeight = await anchor.levels();
    const createdAnchor = new VAnchor(anchor, signer, treeHeight, maxEdges);
    createdAnchor.token = await anchor.token();
    return createdAnchor;
  }

  public static generateUTXO(utxoInputs: IUTXOInputs): Utxo {
    return new Utxo(utxoInputs);
  }

  public static createRootsBytes(rootArray: string[]) {
    let rootsBytes = "0x";
    for (let i = 0; i < rootArray.length; i++) {
      rootsBytes += toFixedHex(rootArray[i]).substr(2);
    }
    return rootsBytes; // root byte string (32 * array.length bytes) 
  };

  public static async groth16ExportSolidityCallData(proof: any, pub: any) {
    let inputs = "";
    for (let i = 0; i < pub.length; i++) {
      if (inputs != "") inputs = inputs + ",";
      inputs = inputs + p256(pub[i]);
    }
  
    let S;
    S=`[${p256(proof.pi_a[0])}, ${p256(proof.pi_a[1])}],` +
      `[[${p256(proof.pi_b[0][1])}, ${p256(proof.pi_b[0][0])}],[${p256(proof.pi_b[1][1])}, ${p256(proof.pi_b[1][0])}]],` +
      `[${p256(proof.pi_c[0])}, ${p256(proof.pi_c[1])}],` +
      `[${inputs}]`;
  
    return S;
  }
  
  public static async generateWithdrawProofCallData(proof: any, publicSignals: any) {
    const result = await VAnchor.groth16ExportSolidityCallData(proof, publicSignals);
    const fullProof = JSON.parse("[" + result + "]");
    const pi_a = fullProof[0];
    const pi_b = fullProof[1];
    const pi_c = fullProof[2];

    let proofEncoded = [
      pi_a[0],
      pi_a[1],
      pi_b[0][0],
      pi_b[0][1],
      pi_b[1][0],
      pi_b[1][1],
      pi_c[0],
      pi_c[1],
    ]
    .map(elt => elt.substr(2))
    .join('');

    return proofEncoded;
  }

  // sync the local tree with the tree on chain.
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
    return toHex(this.contract.address + toHex((await this.signer.getChainId()), 4).substr(2), 32);
  }

  public async setHandler(handlerAddress: string) {
    const tx = await this.contract.setHandler(handlerAddress);
    await tx.wait();
  }

  public async setBridge(bridgeAddress: string) {
    const tx = await this.contract.setBridge(bridgeAddress);
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
  public async getProposalData(leafIndex?: number): Promise<string> {

    // If no leaf index passed in, set it to the most recent one.
    if (!leafIndex) {
      leafIndex = this.tree.number_of_elements() - 1;
    }

    const chainID = await this.signer.getChainId();
    const merkleRoot = this.depositHistory[leafIndex];

    return '0x' +
      toHex(chainID, 32).substr(2) + 
      toHex(leafIndex, 32).substr(2) + 
      toHex(merkleRoot, 32).substr(2);
  }

  public async populateRootInfosForProof(): Promise<RootInfo[]> {
    const neighborEdges = await this.contract.getLatestNeighborEdges();
    const neighborRootInfos = neighborEdges.map((rootData) => {
      return {
        merkleRoot: rootData.root,
        chainId: rootData.chainID,
      }
    });
    const thisRoot = await this.contract.getLastRoot();
    const thisChainId = await this.signer.getChainId();
    return [{
      merkleRoot: thisRoot,
      chainId: thisChainId,
    }, ...neighborRootInfos];
  }

  /**
   * 
   * @param input A UTXO object that is inside the tree
   * @returns 
   */
  public getMerkleProof(input: Utxo): IMerkleProofData {
    let inputMerklePathIndex;
    let inputMerklePathElements;

    if (input.amount > 0) {
      input.index = this.tree.indexOf(toFixedHex(input.getCommitment()))
      if (input.index < 0) {
        throw new Error(`Input commitment ${toFixedHex(input.getCommitment())} was not found`)
      }
      inputMerklePathIndex = input.index;
      inputMerklePathElements = this.tree.path(input.index).pathElements
    } else {
      inputMerklePathIndex = 0;
      inputMerklePathElements = new Array(this.tree.levels).fill(0);
    }

    return {
      pathElements: inputMerklePathElements,
      pathIndex: inputMerklePathIndex,
      merkleRoot: this.tree.root(),
    }
  }

  public async generateWitnessInput(
    roots: RootInfo[], 
    chainId: BigNumberish, 
    inputs: Utxo[], 
    outputs: Utxo[], 
    extAmount: BigNumberish, 
    fee: BigNumberish,
    recipient: string, 
    relayer: string,
    isL1Withdrawal: boolean,
    externalMerkleProofs: any[],
  ): Promise<IWitnessInput> {
    const extData = {
      recipient: toFixedHex(recipient, 20),
      extAmount: toFixedHex(extAmount),
      relayer: toFixedHex(relayer, 20),
      fee: toFixedHex(fee),
      encryptedOutput1: outputs[0].encrypt(),
      encryptedOutput2: outputs[1].encrypt(),
      isL1Withdrawal,
    }
  
    const extDataHash = getExtDataHash(extData)
    let input = {
      roots: roots.map((x) => x.merkleRoot),
      diffs: inputs.map((x) => x.getDiffs(roots, chainId)),
      chainId: chainId,
      inputNullifier: inputs.map((x) => x.getNullifier()),
      outputCommitment: outputs.map((x) => x.getCommitment()),
      publicAmount: BigNumber.from(extAmount).sub(fee).add(FIELD_SIZE).mod(FIELD_SIZE).toString(),
      extDataHash,
  
      // data for 2 transaction inputs
      inAmount: inputs.map((x) => x.amount),
      inPrivateKey: inputs.map((x) => x.keypair.privkey),
      inBlinding: inputs.map((x) => x.blinding),
      inPathIndices: externalMerkleProofs.map((x) => x.pathIndex),
      inPathElements: externalMerkleProofs.map((x) => x.pathElements),
  
      // data for 2 transaction outputs
      outChainID: outputs.map((x) => x.chainId),
      outAmount: outputs.map((x) => x.amount),
      outBlinding: outputs.map((x) => x.blinding),
      outPubkey: outputs.map((x) => x.keypair.pubkey),
    }

    return {
      input,
      extData,
    };
  }

  public generatePublicInputs(
    proof: any,
    roots: RootInfo[],
    inputs: Utxo[],
    outputs: Utxo[],
    publicAmount: BigNumberish,
    extDataHash: string,
  ): IPublicInputs {
    // public inputs to the contract
    const args: IPublicInputs = {
      proof,
      roots: `0x${roots.map((x) => toFixedHex(x.merkleRoot).slice(2)).join('')}`,
      inputNullifiers: inputs.map((x) => toFixedHex(x.getNullifier())),
      outputCommitments: outputs.map((x) => toFixedHex(x.getCommitment())),
      publicAmount: toFixedHex(publicAmount),
      extDataHash: toFixedHex(extDataHash),
    };

    return args;
  }

  public async checkKnownRoot() {
    const isKnownRoot = await this.contract.isKnownRoot(toFixedHex(this.tree.root()));
    if (!isKnownRoot) {
      await this.update(this.latestSyncedBlock);
    }
  }

  public async createWitness(data: any) {
    const fileBuf = require('fs').readFileSync(this.circuitWASMPath);
    const witnessCalculator = await this.witnessCalculator(fileBuf)
    const buff = await witnessCalculator.calculateWTNSBin(data,0);
    return buff;
  }

  public async proveAndVerify(wtns: any) {
    let res = await snarkjs.groth16.prove(this.circuitZkeyPath, wtns);
    let proof = res.proof;
    let publicSignals = res.publicSignals;

    const vKey = await snarkjs.zKey.exportVerificationKey(this.circuitZkeyPath);
    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    let proofEncoded = await VAnchor.generateWithdrawProofCallData(proof, publicSignals);
    return proofEncoded;
  }

  public async setupTransaction(
    inputs: Utxo[], 
    outputs: Utxo[], 
    extAmount: BigNumberish, 
    fee: BigNumberish,
    recipient: string, 
    relayer: string,
    isL1Withdrawal: boolean,
    merkleProofsForInputs: any[],
  ) {
    // first, check if the merkle root is known on chain - if not, then update
    await this.checkKnownRoot();
    const chainId = await this.signer.getChainId();
    const roots = await this.populateRootInfosForProof();

    const { input, extData } = await this.generateWitnessInput(
      roots,
      chainId,
      inputs,
      outputs,
      extAmount,
      fee,
      recipient,
      relayer,
      isL1Withdrawal,
      merkleProofsForInputs
    );

    const wtns = await this.createWitness(input);
    let proofEncoded = await this.proveAndVerify(wtns);

    const publicInputs: IPublicInputs = this.generatePublicInputs(
      proofEncoded,
      roots,
      inputs,
      outputs,
      input.publicAmount,
      input.extDataHash.toString()
    );

    return {
      extData,
      publicInputs,
    };
  }

  public async transact(
    inputs: Utxo[], 
    outputs: Utxo[], 
    extAmount: BigNumberish, 
    fee: BigNumberish,
    recipient: string, 
    relayer: string,
    isL1Withdrawal: boolean,
  ) {
    const merkleProofsForInputs = inputs.map((x) => this.getMerkleProof(x));
    const { extData, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      extAmount,
      fee,
      recipient,
      relayer,
      isL1Withdrawal,
      merkleProofsForInputs,
    );
    let tx = await this.contract.transact(
      {
        ...publicInputs,
        outputCommitments: [
          publicInputs.outputCommitments[0],
          publicInputs.outputCommitments[1],
        ]
      },
      extData,
      { gasLimit: '0x5B8D80' }
    );
    const receipt = await tx.wait();
    return receipt;
  }

  public async bridgedWithdraw(
    inputs: Utxo[],
    outputs: Utxo[],
    extAmount: BigNumberish,
    fee: BigNumberish,
    recipient: string,
    relayer: string,
    isL1Withdrawal: boolean,
    merkleProofsForInputs: any[]
  ) {
    // const { pathElements, pathIndices, merkleRoot } = merkleProofsForInputs;
    if (merkleProofsForInputs.length !== inputs.length) {
      throw new Error('Merkle proofs has different length than inputs');
    }
    const { extData, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      extAmount,
      fee,
      recipient,
      relayer,
      isL1Withdrawal,
      merkleProofsForInputs,
    );

    let tx = await this.contract.transact(
      {
        ...publicInputs,
        outputCommitments: [
          publicInputs.outputCommitments[0],
          publicInputs.outputCommitments[1],
        ]
      },
      extData,
      { gasLimit: '0x5B8D80' }
    );
    const receipt = await tx.wait();
    return receipt;
  }
}

export default VAnchor;
