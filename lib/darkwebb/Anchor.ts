import { BigNumber, BigNumberish, ethers } from "ethers";
import { Anchor__factory } from '../../typechain/factories/Anchor__factory';
import { Anchor as AnchorContract} from '../../typechain/Anchor';
import { rbigint, p256 } from "./utils";
import { toFixedHex, toHex } from '../../lib/darkwebb/utils';
import PoseidonHasher from './Poseidon';
import { MerkleTree } from './MerkleTree';

const path = require('path');
const snarkjs = require('snarkjs');
const F = require('circomlib').babyJub.F;
const Scalar = require('ffjavascript').Scalar;

export interface AnchorDepositInfo {
  chainID: BigInt,
  secret: BigInt,
  nullifier: BigInt,
  commitment: string,
  nullifierHash: string,
};

export interface AnchorDeposit {
  deposit: AnchorDepositInfo,
  index: number,
  originChainId: number;
};

export interface IPublicInputs {
  _roots: string;
  _nullifierHash: string;
  _refreshCommitment: string;
  _recipient: string;
  _relayer: string;
  _fee: string;
  _refund: string;
}

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods 
class Anchor {
  signer: ethers.Signer;
  contract: AnchorContract;
  tree: MerkleTree;
  // hex string of the connected root
  latestSyncedBlock: number;
  circuitZkeyPath: string;
  circuitWASMPath: string;

  // The depositHistory stores leafIndex => information to create proposals (new root)
  depositHistory: Record<number, string>;
  token?: string;
  denomination?: string;

  private constructor(
    contract: AnchorContract,
    signer: ethers.Signer,
    treeHeight: number,
    maxEdges: number,
  ) {
    this.signer = signer;
    this.contract = contract;
    this.tree = new MerkleTree('', treeHeight);
    this.latestSyncedBlock = 0;
    this.depositHistory = {};

    // set the circuit zkey and wasm depending upon max edges
    switch (maxEdges) {
      case 1:
        this.circuitWASMPath = 'test/fixtures/2/poseidon_bridge_2.wasm';
        this.circuitZkeyPath = 'test/fixtures/2/circuit_final.zkey';
        break;
      case 2:
        this.circuitWASMPath = 'test/fixtures/3/poseidon_bridge_3.wasm';
        this.circuitZkeyPath = 'test/fixtures/3/circuit_final.zkey';
        break;
      case 3:
        this.circuitWASMPath = 'test/fixtures/4/poseidon_bridge_4.wasm';
        this.circuitZkeyPath = 'test/fixtures/4/circuit_final.zkey';
        break;
      case 4:
        this.circuitWASMPath = 'test/fixtures/5/poseidon_bridge_5.wasm';
        this.circuitZkeyPath = 'test/fixtures/5/circuit_final.zkey';
        break;
      case 5:
        this.circuitWASMPath = 'test/fixtures/6/poseidon_bridge_6.wasm';
        this.circuitZkeyPath = 'test/fixtures/6/circuit_final.zkey';
        break;
      default:
        this.circuitWASMPath = 'test/fixtures/2/poseidon_bridge_2.wasm';
        this.circuitZkeyPath = 'test/fixtures/2/circuit_final.zkey';
        break;
    }

  }

  // public static anchorFromAddress(
  //   contract: string,
  //   signer: ethers.Signer,
  // ) {
  //   const anchor = Anchor__factory.connect(contract, signer);
  //   return new Anchor(anchor, signer);
  // }

  // Deploys an Anchor contract and sets the signer for deposit and withdraws on this contract.
  public static async createAnchor(
    verifier: string,
    hasher: string,
    denomination: BigNumberish,
    merkleTreeHeight: number,
    token: string,
    bridge: string,
    admin: string,
    handler: string,
    maxEdges: number,
    signer: ethers.Signer,
  ) {
    const factory = new Anchor__factory(signer);
    const anchor = await factory.deploy(verifier, hasher, denomination, merkleTreeHeight, token, bridge, admin, handler, maxEdges, {});
    await anchor.deployed();
    const createdAnchor = new Anchor(anchor, signer, merkleTreeHeight, maxEdges);
    createdAnchor.latestSyncedBlock = anchor.deployTransaction.blockNumber!;
    createdAnchor.denomination = denomination.toString();
    createdAnchor.token = token;
    return createdAnchor;
  }

  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    signer: ethers.Signer,
  ) {
    const anchor = Anchor__factory.connect(address, signer);
    const maxEdges = await anchor.maxEdges()
    const treeHeight = await anchor.levels();
    const createdAnchor = new Anchor(anchor, signer, treeHeight, maxEdges);
    createdAnchor.token = await anchor.token();
    return createdAnchor;
  }

  public static generateDeposit(destinationChainId: number, secretBytesLen: number = 31, nullifierBytesLen: number = 31): AnchorDepositInfo {
    const chainID = BigInt(destinationChainId);
    const secret = rbigint(secretBytesLen);
    const nullifier = rbigint(nullifierBytesLen);

    const hasher = new PoseidonHasher();
    const commitment = hasher.hash3([chainID, nullifier, secret]).toString();
    const nullifierHash = hasher.hash(null, nullifier, nullifier);

    const deposit: AnchorDepositInfo = {
      chainID,
      secret,
      nullifier,
      commitment,
      nullifierHash
    };
  
    return deposit
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
    const result = await Anchor.groth16ExportSolidityCallData(proof, publicSignals);
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

  // Makes a deposit into the contract and return the parameters and index of deposit
  public async deposit(destinationChainId?: number): Promise<AnchorDeposit> {
    const originChainId = await this.signer.getChainId();
    const destChainId = (destinationChainId) ? destinationChainId : originChainId;
    const deposit = Anchor.generateDeposit(destChainId);
    
    const tx = await this.contract.deposit(toFixedHex(deposit.commitment), { gasLimit: '0x5B8D80' });
    const receipt = await tx.wait();

    const index: number = this.tree.insert(deposit.commitment);
    this.depositHistory[index] = await this.contract.getLastRoot();

    const root = await this.contract.getLastRoot();

    return { deposit, index, originChainId };
  }

  public async wrapAndDeposit(tokenAddress: string, destinationChainId?: number): Promise<AnchorDeposit> {
    const originChainId = await this.signer.getChainId();
    const chainId = (destinationChainId) ? destinationChainId : originChainId;
    const deposit = Anchor.generateDeposit(chainId);
    const tx = await this.contract.wrapAndDeposit(tokenAddress, toFixedHex(deposit.commitment), { gasLimit: '0x5B8D80' });
    await tx.wait();

    const index: number = await this.tree.insert(deposit.commitment);

    const root = await this.contract.getLastRoot();

    this.depositHistory[index] = root;

    return { deposit, index, originChainId };
  }

  // sync the local tree with the tree on chain.
  // Start syncing from the given block number, otherwise zero.
  public async update(blockNumber?: number) {
    const filter = this.contract.filters.Deposit();
    const currentBlockNumber = await this.signer.provider!.getBlockNumber();
    const events = await this.contract.queryFilter(filter, blockNumber || 0);
    const commitments = events.map((event) => event.args.commitment);
    this.tree.batch_insert(commitments);

    this.latestSyncedBlock = currentBlockNumber;
  }

  public async populateRootsForProof(): Promise<string[]> {
    const neighborRoots = await this.contract.getLatestNeighborRoots();
    return [await this.contract.getLastRoot(), ...neighborRoots];
  }

  public async generateWitnessInput(
    deposit: AnchorDepositInfo,
    originChain: number,
    refreshCommitment: string | number,
    recipient: BigInt,
    relayer: BigInt,
    fee: BigInt,
    refund: BigInt,
    roots: string[],
    pathElements: any[],
    pathIndices: any[],
  ): Promise<any> {
    const { chainID, nullifierHash, nullifier, secret } = deposit;
    let rootDiffIndex: number;
    // read the origin chain's index into the roots array
    if (chainID == BigInt(originChain)) {
      rootDiffIndex = 0;
    } else {
      const edgeIndex = await this.contract.edgeIndex(originChain);
      rootDiffIndex = edgeIndex.toNumber() + 1;
    }
    
    return {
      // public
      nullifierHash, refreshCommitment, recipient, relayer, fee, refund, chainID, roots,
      // private
      nullifier, secret, pathElements, pathIndices, diffs: roots.map(r => {
        return F.sub(
          Scalar.fromString(`${r}`),
          Scalar.fromString(`${roots[rootDiffIndex]}`),
        ).toString();
      }),
    };
  }

  public async checkKnownRoot() {
    const isKnownRoot = await this.contract.isKnownRoot(toFixedHex(await this.tree.get_root()));
    if (!isKnownRoot) {
      await this.update(this.latestSyncedBlock);
    }
  }

  public async createWitness(data: any) {
    const wtns = {type: "mem"};
    await snarkjs.wtns.calculate(data, path.join('.', this.circuitWASMPath), wtns);
    return wtns;
  }

  public async proveAndVerify(wtns: any) {
    let res = await snarkjs.groth16.prove(this.circuitZkeyPath, wtns);
    let proof = res.proof;
    let publicSignals = res.publicSignals;

    const vKey = await snarkjs.zKey.exportVerificationKey(this.circuitZkeyPath);
    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    let proofEncoded = await Anchor.generateWithdrawProofCallData(proof, publicSignals);
    return proofEncoded;
  }

  public async setupWithdraw(
    deposit: AnchorDepositInfo,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string | number,
  ) {
    // first, check if the merkle root is known on chain - if not, then update
    await this.checkKnownRoot();

    const { merkleRoot, pathElements, pathIndices } = await this.tree.path(index);
    const chainId = await this.signer.getChainId();

    const roots = await this.populateRootsForProof();

    const input = await this.generateWitnessInput(
      deposit,
      chainId,
      refreshCommitment,
      BigInt(recipient),
      BigInt(relayer),
      BigInt(fee),
      BigInt(0),
      roots,
      pathElements,
      pathIndices,
    );

    const wtns = await this.createWitness(input);
    let proofEncoded = await this.proveAndVerify(wtns);

    const args = [
      Anchor.createRootsBytes(input.roots),
      toFixedHex(input.nullifierHash),
      toFixedHex(input.refreshCommitment, 32),
      toFixedHex(input.recipient, 20),
      toFixedHex(input.relayer, 20),
      toFixedHex(input.fee),
      toFixedHex(input.refund),
    ];

    const publicInputs = Anchor.convertArgsArrayToStruct(args);
    return {
      input,
      args,
      proofEncoded,
      publicInputs,
    };
  }

  public async withdraw(
    deposit: AnchorDepositInfo,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string | number,
  ) {
    const { args, input, proofEncoded, publicInputs } = await this.setupWithdraw(
      deposit,
      index,
      recipient,
      relayer,
      fee,
      refreshCommitment,
    );
    //@ts-ignore
    let tx = await this.contract.withdraw(
      `0x${proofEncoded}`,
      publicInputs,
      { gasLimit: '0x5B8D80' }
    );
    const receipt = await tx.wait();

    if (args[2] !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      this.tree.insert(input.refreshCommitment);
      const filter = this.contract.filters.Refresh(null, null, null);
      const events = await this.contract.queryFilter(filter, receipt.blockHash);
      return events[0];
    } else {
      const filter = this.contract.filters.Withdrawal(null, null, relayer, null);
      const events = await this.contract.queryFilter(filter, receipt.blockHash);
      return events[0];
    }
  }

  public async withdrawAndUnwrap(
    deposit: AnchorDepositInfo,
    originChainId: number,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string,
    tokenAddress: string,
  ) {
    // first, check if the merkle root is known on chain - if not, then update
    await this.checkKnownRoot();

    const { merkleRoot, pathElements, pathIndices } = await this.tree.path(index);

    const roots = await this.populateRootsForProof();

    const input = await this.generateWitnessInput(
      deposit,
      originChainId,
      refreshCommitment,
      BigInt(recipient),
      BigInt(relayer),
      BigInt(fee),
      BigInt(0),
      roots,
      pathElements,
      pathIndices,
    );

    const wtns = await this.createWitness(input);
    let proofEncoded = await this.proveAndVerify(wtns);

    const args = [
      Anchor.createRootsBytes(input.roots),
      toFixedHex(input.nullifierHash),
      toFixedHex(input.refreshCommitment, 32),
      toFixedHex(input.recipient, 20),
      toFixedHex(input.relayer, 20),
      toFixedHex(input.fee),
      toFixedHex(input.refund),
    ];

    const publicInputs = Anchor.convertArgsArrayToStruct(args);

    //@ts-ignore
    let tx = await this.contract.withdrawAndUnwrap(`0x${proofEncoded}`, publicInputs, tokenAddress, { gasLimit: '0x5B8D80' });
    const receipt = await tx.wait();

    const filter = this.contract.filters.Withdrawal(null, null, null, null);
    const events = await this.contract.queryFilter(filter, receipt.blockHash);
    return events[0];
  }

  // A bridgedWithdraw needs the merkle proof to be generated from an anchor other than this one,
  public async bridgedWithdraw(
    deposit: AnchorDeposit,
    merkleProof: any,
    recipient: string,
    relayer: string,
    fee: string,
    refund: string,
    refreshCommitment: string,
    tokenAddress: string,
  ) {
    const { pathElements, pathIndices, merkleRoot } = merkleProof;
    const isKnownNeighborRoot = await this.contract.isKnownNeighborRoot(deposit.originChainId, toFixedHex(merkleRoot));
    if (!isKnownNeighborRoot) {
      throw new Error("Neighbor root not found");
    }
    refreshCommitment = (refreshCommitment) ? refreshCommitment : '0';

    const lastRoot = await this.tree.get_root();

    const roots = await this.populateRootsForProof();

    const input = await this.generateWitnessInput(
      deposit.deposit,
      deposit.originChainId,
      refreshCommitment,
      BigInt(recipient),
      BigInt(relayer),
      BigInt(fee),
      BigInt(refund),
      roots,
      pathElements,
      pathIndices,
    );

    const wtns = await this.createWitness(input);
    let proofEncoded = await this.proveAndVerify(wtns);

    const args = [
      Anchor.createRootsBytes(input.roots),
      toFixedHex(input.nullifierHash),
      toFixedHex(input.refreshCommitment, 32),
      toFixedHex(input.recipient, 20),
      toFixedHex(input.relayer, 20),
      toFixedHex(input.fee),
      toFixedHex(input.refund),
    ];

    const publicInputs = Anchor.convertArgsArrayToStruct(args);

    //@ts-ignore
    let tx = await this.contract.withdraw(
      `0x${proofEncoded}`,
      publicInputs,
      {
        gasLimit: '0x5B8D80'
      },
    );
    const receipt = await tx.wait();

    const filter = this.contract.filters.Withdrawal(null, null, relayer, null);
    const events = await this.contract.queryFilter(filter, receipt.blockHash);
    return events[0];
  }

  public static convertArgsArrayToStruct(args: any[]): IPublicInputs {
    return {
      _roots: args[0],
      _nullifierHash: args[1],
      _refreshCommitment: args[2],
      _recipient: args[3],
      _relayer: args[4],
      _fee: args[5],
      _refund: args[6],
    };
  }
}

export default Anchor;
