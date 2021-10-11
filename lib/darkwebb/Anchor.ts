import { BigNumber, BigNumberish, ethers } from "ethers";
import { Anchor2__factory } from '../../typechain/factories/Anchor2__factory';
import { Anchor2 } from '../../typechain/Anchor2';
import { rbigint, p256 } from "./utils";
import { toFixedHex, toHex } from '../../lib/darkwebb/utils';
import PoseidonHasher from './Poseidon';
import { MerkleTree } from './MerkleTree';
import bigInt from "big-integer";

const path = require('path');
const snarkjs = require('snarkjs');
const F = require('circomlib').babyJub.F;
const Scalar = require('ffjavascript').Scalar;

interface AnchorDepositInfo {
  chainID: BigInt,
  secret: BigInt,
  nullifier: BigInt,
  commitment: string,
  nullifierHash: string,
};

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods 
class Anchor {
  signer: ethers.Signer;
  contract: Anchor2;
  tree: MerkleTree;
  // hex string of the connected root
  linkedRoot: string;
  latestSyncedBlock: number;
  circuitZkeyPath: string;
  circuitWASMPath: string;

  private constructor(
    contract: Anchor2,
    signer: ethers.Signer,
    treeHeight: number,
    circuitZkeyPath?: string,
    circuitWASMPath?: string,
  ) {
    this.signer = signer;
    this.contract = contract;
    this.tree = new MerkleTree('', treeHeight);
    this.linkedRoot = "0x0";
    this.latestSyncedBlock = 0;
    this.circuitZkeyPath = circuitZkeyPath || 'test/fixtures/2/circuit_final.zkey';
    this.circuitWASMPath = circuitZkeyPath || 'test/fixtures/2/poseidon_bridge_2.wasm';
  }

  // public static anchorFromAddress(
  //   contract: string,
  //   signer: ethers.Signer,
  // ) {
  //   const anchor = Anchor2__factory.connect(contract, signer);
  //   return new Anchor(anchor, signer);
  // }

  // Deploys an anchor2 contract and sets the signer for deposit and withdraws on this contract.
  public static async createAnchor(
    verifier: string,
    hasher: string,
    denomination: BigNumberish,
    merkleTreeHeight: number,
    token: string,
    bridge: string,
    admin: string,
    handler: string,
    signer: ethers.Signer,
  ) {
    const factory = new Anchor2__factory(signer);
    const anchor2 = await factory.deploy(verifier, hasher, denomination, merkleTreeHeight, token, bridge, admin, handler, {});
    await anchor2.deployed();
    const createdAnchor = new Anchor(anchor2, signer, merkleTreeHeight);
    createdAnchor.latestSyncedBlock = anchor2.deployTransaction.blockNumber!;
    return createdAnchor;
  }

  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    signer: ethers.Signer,
  ) {
    const anchor2 = Anchor2__factory.connect(address, signer);
    const treeHeight = await anchor2.levels();
    const createdAnchor = new Anchor(anchor2, signer, treeHeight);

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

  // public static async createWitness(data: any): Promise<{type: string, data: Uint8Array}> {
  //   const wtns: {type: string, data: Uint8Array} = {type: "mem", data: new Uint8Array()};
  //   await snarkjs.wtns.calculate(data, path.join(
  //     "test",
  //     "fixtures",
  //     "poseidon_bridge_2.wasm"
  //   ), wtns);
  //   return wtns;
  // }

  // 
  public async createResourceId(): Promise<string> {
    return toHex(this.contract.address + toHex((await this.signer.getChainId()).toString(), 4).substr(2), 32);
  }

  public async setHandler(handlerAddress: string) {
    const tx = await this.contract.setHandler(handlerAddress);
    await tx.wait();
  }

  public async setBridge(bridgeAddress: string) {
    const tx = await this.contract.setBridge(bridgeAddress);
    await tx.wait();
  }

  // Proposal data is used to update linkedAnchors via bridge proposals 
  // on other chains with this anchor's state
  public async getProposalData(): Promise<string> {
    const chainId = await this.signer.getChainId();
    const latestLeafIndex = this.tree.totalElements - 1;
    const merkleRoot = await this.tree.get_root();

    return '0x' +
      toHex(chainId.toString(), 32).substr(2) + 
      toHex(latestLeafIndex.toString(), 32).substr(2) + 
      toHex(merkleRoot, 32).substr(2);
  }

  // Makes a deposit into the contract and return the parameters and index of deposit
  public async deposit(destinationChainId?: number): Promise<{deposit: AnchorDepositInfo, index: number}> {
    const chainId = (destinationChainId) ? destinationChainId : await this.signer.getChainId();
    const deposit = Anchor.generateDeposit(chainId);
    
    const tx = await this.contract.deposit(toFixedHex(deposit.commitment), { gasLimit: '0x5B8D80' });
    await tx.wait();

    const index: number = await this.tree.insert(deposit.commitment);

    return { deposit, index };
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

  public generateWitnessInput(
    deposit: AnchorDepositInfo,
    refreshCommitment: BigInt,
    recipient: BigInt,
    relayer: BigInt,
    fee: BigInt,
    refund: BigInt,
    roots: string[],
    pathElements: any[],
    pathIndices: any[],
  ): any {
    const { chainID, nullifierHash, nullifier, secret } = deposit;
    return {
      // public
      nullifierHash, refreshCommitment, recipient, relayer, fee, refund, chainID, roots,
      // private
      nullifier, secret, pathElements, pathIndices, diffs: roots.map(r => {
        return F.sub(
          Scalar.fromString(`${r}`),
          Scalar.fromString(`${roots[0]}`),
        ).toString();
      }),
    };
  }

  public async withdraw(
    deposit: AnchorDepositInfo,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: bigint,
  ) {
    // first, check if the merkle root is known on chain - if not, then update
    const isKnownRoot = await this.contract.isKnownRoot(toFixedHex(await this.tree.get_root()));
    if (!isKnownRoot) {
      await this.update(this.latestSyncedBlock);
    }

    const { root, pathElements, pathIndex } = await this.tree.path(index);

    const input = this.generateWitnessInput(
      deposit,
      refreshCommitment,
      BigInt(recipient),
      BigInt(relayer),
      BigInt(fee),
      BigInt(0),
      [root as string, '0'],
      pathElements,
      pathIndex,
    );

    const createWitness = async (data: any) => {
      const wtns = {type: "mem"};
      await snarkjs.wtns.calculate(data, path.join('.', this.circuitWASMPath), wtns);
      return wtns;
    }

    const wtns = await createWitness(input);

    let res = await snarkjs.groth16.prove(this.circuitZkeyPath, wtns);
    let proof = res.proof;
    let publicSignals = res.publicSignals;

    const args = [
      Anchor.createRootsBytes(input.roots),
      toFixedHex(input.nullifierHash),
      toFixedHex(input.refreshCommitment, 32),
      toFixedHex(input.recipient, 20),
      toFixedHex(input.relayer, 20),
      toFixedHex(input.fee),
      toFixedHex(input.refund),
    ]

    const vKey = await snarkjs.zKey.exportVerificationKey(this.circuitZkeyPath);
    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    let proofEncoded = await Anchor.generateWithdrawProofCallData(proof, publicSignals);

    //@ts-ignore
    let tx = await this.contract.withdraw(`0x${proofEncoded}`, ...args, { gasLimit: '0x5B8D80' });
    const receipt = await tx.wait();

    const filter = this.contract.filters.Withdrawal(null, null, relayer, null);
    const events = await this.contract.queryFilter(filter, receipt.blockHash);
    return events[0];
  }
}

export default Anchor;
