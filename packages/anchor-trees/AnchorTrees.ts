import { ethers, BigNumberish, BigNumber } from "ethers";
import { AnchorTrees as AnchorTreesContract, AnchorTrees__factory } from '@webb-tools/contracts';
import { MerkleTree } from "./MerkleTree";
import { p256, toHex } from '@webb-tools/utils';
import { toFixedHex, bitsToNumber, poseidonHash, toBuffer } from "./utils";
const jsSHA = require('jssha')
const snarkjs = require('snarkjs');

export class AnchorTrees {
  signer: ethers.Signer;
  contract: AnchorTreesContract;
  depositTree: MerkleTree;
  withdrawalTree: MerkleTree;

  constructor(
    signer: ethers.Signer,
    contract: AnchorTreesContract,
    treeHeight: number
  ) {
    this.signer = signer;
    this.contract = contract;
    this.depositTree = new MerkleTree(treeHeight);
    this.withdrawalTree = new MerkleTree(treeHeight);
  }

  public static async createAnchorTrees (
    _governance: string,
    _anchorTreesV1: string,
    _searchParams: {
      depositsFrom: BigNumberish,
      depositsStep: BigNumberish,
      withdrawalsFrom: BigNumberish,
      withdrawalsStep: BigNumberish
    },
    levels: BigNumberish,
    _maxEdges: number,
    deployer: ethers.Signer
  ) {
    
    const factory = new AnchorTrees__factory(deployer);
    const contract = await factory.deploy(_governance, _anchorTreesV1, _searchParams, _maxEdges);
    await contract.deployed();

    return new AnchorTrees(deployer, contract, BigNumber.from(levels).toNumber());
  }

  public async initialize(
    anchorProxy: string,
    verifier: string,
  ) {
    const tx = await this.contract.initialize(anchorProxy, verifier);
    await tx.wait();
  }

  public static hashInputs(input) {
    const sha = new jsSHA('SHA-256', 'ARRAYBUFFER')
    sha.update(toBuffer(input.oldRoot, 32))
    sha.update(toBuffer(input.newRoot, 32))
    sha.update(toBuffer(input.pathIndices, 4))
  
    for (let i = 0; i < input.instances.length; i++) {
      sha.update(toBuffer(input.hashes[i], 32))
      sha.update(toBuffer(input.instances[i], 20))
      sha.update(toBuffer(input.blocks[i], 4))
    }
  
    const hash = '0x' + sha.getHash('HEX')
    const result = BigNumber.from(hash)
      .mod(BigNumber.from('21888242871839275222246405745257275088548364400416034343698204186575808495617'))
      .toString()
    return result
  }

  /**
   * Generates inputs for a snark and tornado trees smart contract.
   * This function updates MerkleTree argument
   *
   * @param tree Merkle tree with current smart contract state. This object is mutated during function execution.
   * @param events New batch of events to insert.
   * @returns {{args: [string, string, string, string, *], input: {pathElements: *, instances: *, blocks: *, newRoot: *, hashes: *, oldRoot: *, pathIndices: string}}}
   */
  public static batchTreeUpdate(tree, events) {
    const batchHeight = Math.log2(events.length)
    if (!Number.isInteger(batchHeight)) {
      throw new Error('events length has to be power of 2')
    }

    const oldRoot = tree.root().toString()
    const leaves = events.map((e) => poseidonHash([e.instance, e.hash, e.block]))
    tree.bulkInsert(leaves)
    const newRoot = tree.root().toString()
    let { pathElements, pathIndices } = tree.path(tree.elements().length - 1)
    pathElements = pathElements.slice(batchHeight).map((a) => BigNumber.from(a).toString())
    pathIndices = bitsToNumber(pathIndices.slice(batchHeight)).toString()

    const input:any = {
      oldRoot: oldRoot,
      newRoot: newRoot,
      pathIndices: pathIndices,
      pathElements: pathElements,
      instances: events.map((e) => BigNumber.from(e.instance).toString()),
      hashes: events.map((e) => BigNumber.from(e.hash).toString()),
      blocks: events.map((e) => BigNumber.from(e.block).toString()),
    }

    input.argsHash = AnchorTrees.hashInputs(input)

    const args:[string, string, string, string, any] = [
      toFixedHex(input.argsHash),
      toFixedHex(input.oldRoot),
      toFixedHex(input.newRoot),
      toFixedHex(input.pathIndices, 4),
      events.map((e) => ({
        hash: toFixedHex(e.hash),
        instance: toFixedHex(e.instance, 20),
        block: toFixedHex(e.block, 4),
      })),
    ];

    return {input, args};
  }

  /**
   * 
   * What are the steps for getting the proof?
   * 
   * First need to generate a witness 
   * Then need to use this witness to generate a proof
   * It's really simple
   * Do everything in the updateDepositTree function for now...and then move out logic into separate functions...no need to over optimize now
   */

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

   public static async generateProofCallData(proof: any, publicSignals: any) {
    const result = await AnchorTrees.groth16ExportSolidityCallData(proof, publicSignals);
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

   //TODO: define zkey path
   public async proveAndVerify(wtns: any) {
    let res = await snarkjs.groth16.prove(this.ZkeyPath, wtns);
    let proof = res.proof;
    let publicSignals = res.publicSignals;

    const vKey = await snarkjs.zKey.exportVerificationKey(this.zkeypath);
    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    let proofEncoded = await AnchorTrees.generateProofCallData(proof, publicSignals);
    return proofEncoded;
  }

  //TODO: need to define WASMPath and witnessCalculator
  public async createWitness(data: any) {
    const fileBuf = require('fs').readFileSync(this.WASMPath);
    const witnessCalculator = this.witnessCalculator(fileBuf);
    const buff = await witnessCalculator.calculateWTNSBin(data,0);
    return buff;
  }
  
  public async updateDepositTree(events) {
    const {input, args} = AnchorTrees.batchTreeUpdate(this.depositTree, events);

    //Generating Proof
    //Step 1: Generate the witness input
    //This is already done by the batchTreeUpdate method taken from tornado so we can skip.

    //Step 2: Create the witness
    const wtns = this.createWitness(input);

    //Step 3: Use the wtns to generate a proof
    let proofEncoded = await this.proveAndVerify(wtns);

    //End generating Proof

    const tx = await this.contract.updateDepositTree(proofEncoded, ...args); 
    tx.wait();
  }

  public async updateWithdrawalTree(events) {
    const {input, args} = AnchorTrees.batchTreeUpdate(this.withdrawalTree, events);

    //Generating Proof
    //Step 1: Generate the witness input
    //This is already done by the batchTreeUpdate method taken from tornado so we can skip.

    //Step 2: Create the witness
    const wtns = this.createWitness(input);

    //Step 3: Use the wtns to generate a proof
    let proofEncoded = await this.proveAndVerify(wtns);

    //End generating Proof

    const tx = await this.contract.updateDepositTree(proofEncoded, ...args); 
    tx.wait();
  }
  
}
