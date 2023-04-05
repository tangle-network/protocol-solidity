import {
  ProxiedBatchMerkleTree as ProxiedBatchMerkleTreeContract,
  ProxiedBatchMerkleTree__factory,
} from '@webb-tools/contracts';
import { MerkleTree, toBuffer, toFixedHex } from '@webb-tools/sdk-core';
import { BigNumber, ethers } from 'ethers';
import jsSHA from 'jssha';
const assert = require('assert');

import { ZkComponents } from '@webb-tools/utils';

const snarkjs = require('snarkjs');

type ProofSignals = {
  oldRoot: string;
  newRoot: string;
  pathIndices: number;
  pathElements: string[];
  leaves: string[];
  argsHash?: string;
};

const SNARK_FIELD_SIZE = BigNumber.from(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

export class ProxiedBatchTreeUpdater {
  signer: ethers.Signer;
  contract: ProxiedBatchMerkleTreeContract;
  tree: MerkleTree;
  // hex string of the connected root
  latestSyncedBlock: number;
  zkComponents_4: ZkComponents;
  zkComponents_8: ZkComponents;
  zkComponents_16: ZkComponents;
  zkComponents_32: ZkComponents;

  constructor(
    contract: ProxiedBatchMerkleTreeContract,
    signer: ethers.Signer,
    levels: number,
    zkComponents_4: ZkComponents,
    zkComponents_8: ZkComponents,
    zkComponents_16: ZkComponents,
    zkComponents_32: ZkComponents
  ) {
    this.contract = contract;
    this.signer = signer;
    this.tree = new MerkleTree(levels);
    this.latestSyncedBlock = 0;
    this.zkComponents_4 = zkComponents_4;
    this.zkComponents_8 = zkComponents_8;
    this.zkComponents_16 = zkComponents_16;
    this.zkComponents_32 = zkComponents_32;
  }

  public static async createProxiedBatchTreeUpdater(
    verifierAddr: string,
    levels: number,
    hasherAddr: string,
    proxyAddr: string,
    zkComponents_4: ZkComponents,
    zkComponents_8: ZkComponents,
    zkComponents_16: ZkComponents,
    zkComponents_32: ZkComponents,
    signer: ethers.Signer
  ) {
    const factory = new ProxiedBatchMerkleTree__factory(signer);
    const contract = await factory.deploy(levels, hasherAddr, verifierAddr, proxyAddr);
    await contract.deployed();

    const createdProxiedBatchTreeUpdater = new ProxiedBatchTreeUpdater(
      contract,
      signer,
      levels,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32
    );
    createdProxiedBatchTreeUpdater.latestSyncedBlock = contract.deployTransaction.blockNumber!;
    return createdProxiedBatchTreeUpdater;
  }

  public static async connect(
    contractAddr: string,
    zkComponents_4: ZkComponents,
    zkComponents_8: ZkComponents,
    zkComponents_16: ZkComponents,
    zkComponents_32: ZkComponents,
    signer: ethers.Signer
  ) {
    const factory = new ProxiedBatchMerkleTree__factory(signer);
    const proxiedBatchTreeContract = factory.attach(contractAddr);
    const levels = await proxiedBatchTreeContract.levels();
    const createdProxiedBatchTreeUpdater = new ProxiedBatchTreeUpdater(
      proxiedBatchTreeContract,
      signer,
      levels,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32
    );
    return createdProxiedBatchTreeUpdater;
  }

  public static hashInputs(input: ProofSignals) {
    const sha = new jsSHA('SHA-256', 'ARRAYBUFFER');
    console.log("old root", toFixedHex(BigNumber.from(input.oldRoot).mod(SNARK_FIELD_SIZE)));
    sha.update(toBuffer(BigNumber.from(input.oldRoot).mod(SNARK_FIELD_SIZE), 32));
    console.log("new root", toFixedHex(BigNumber.from(input.newRoot).mod(SNARK_FIELD_SIZE)));
    sha.update(toBuffer(BigNumber.from(input.newRoot).mod(SNARK_FIELD_SIZE), 32));
    sha.update(toBuffer(input.pathIndices, 4));

    for (let i = 0; i < input.leaves.length; i++) {
      console.log("leaves", toFixedHex(BigNumber.from(input.leaves[i]).mod(SNARK_FIELD_SIZE)));
      sha.update(toBuffer(BigNumber.from(input.leaves[i]).mod(SNARK_FIELD_SIZE), 32));
    }

    const hash = '0x' + sha.getHash('HEX');
    const result = BigNumber.from(hash)
      .mod(
        SNARK_FIELD_SIZE
      )
      .toString();
    return result;
  }

  // public async registerInsertion(instance: string, commitment: BigNumberish) {
  //   return await this.contract.registerInsertion(instance, toFixedHex(commitment));
  // }

  // public async registerInsertions(instances: string[], commitments: BigNumberish[]) {
  //   assert(instances.length === commitments.length);
  //   let transactions = [];
  //   for (let i = 0; i < instances.length; i++) {
  //     let tx = await this.contract.registerInsertion(instances[i], toFixedHex(commitments[i]));
  //     transactions.push(tx);
  //   }
  //   return transactions;
  // }
  public async validateBatchSize(batchSize: number) {
    if (batchSize == 4) {
      return this.zkComponents_4;
    } else if (batchSize === 8) {
      return this.zkComponents_8;
    } else if (batchSize === 16) {
      return this.zkComponents_16;
    } else if (batchSize === 32) {
      return this.zkComponents_32;
    } else {
      throw new Error('Invalid batch size');
    }
  }

  public async generateProof(batchSize: number, leaves: string[]) {
    assert(leaves.length == batchSize);
    let batchHeight = Math.log2(batchSize);

    const zkComponent = await this.validateBatchSize(batchSize);

    const oldRoot: string = this.tree.root().toString();

    this.tree.bulkInsert(leaves);
    const newRoot: string = this.tree.root().toString();
    let { pathElements, pathIndices } = this.tree.path(this.tree.elements().length - 1);
    console.log(pathIndices, 'pathIndices');
    let batchPathElements: string[] = pathElements.slice(batchHeight).map((e) => e.toString());
    let batchPathIndices: number = MerkleTree.calculateIndexFromPathIndices(
      pathIndices.slice(batchHeight)
    );
    console.log(batchPathIndices, 'batchPathIndices');
    // pathIndices = MerkleTree.calculateIndexFromPathIndices(pathIndices.slice(batchHeight));
    const input: ProofSignals = {
      oldRoot,
      newRoot,
      pathIndices: batchPathIndices,
      pathElements: batchPathElements,
      leaves,
    };

    console.log(input);

    input['argsHash'] = ProxiedBatchTreeUpdater.hashInputs(input);

    const wtns = await zkComponent.witnessCalculator.calculateWTNSBin(input, 0);
    
    const res= await snarkjs.groth16.prove(
      zkComponent.zkey,
      wtns,
    );

    const calldata = await snarkjs.groth16.exportSolidityCallData(res.proof, res.publicSignals);
    const proofJson = JSON.parse('[' + calldata + ']');
    const pi_a = proofJson[0];
    const pi_b = proofJson[1];
    const pi_c = proofJson[2];

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
      .map((elt) => elt.substr(2))
      .join('');

    proofEncoded = `0x${proofEncoded}`;

    const proof = proofEncoded;
    const publicSignals = res.publicSignals;
    console.log(proof, publicSignals, 'proof, publicSignals')

    // const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    //   input,
    //   zkComponent.wasm,
    //   zkComponent.zkey
    // );
    // const vKey = await snarkjs.zKey.exportVerificationKey(zkComponent.zkey);
    // const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    return { input, proof, publicSignals };
  }

  public async batchInsert(batchSize: number) {
    let batchHeight = Math.log2(batchSize);
    let leaves = [];
    let startIndex = await this.contract.nextIndex();
    for (var i = startIndex; i < startIndex + batchSize; i++) {
      let c = await this.contract.queue(i);
      leaves.push(c);
    }

    const { input, proof, publicSignals } = await this.generateProof(batchSize, leaves);
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const proofJson = JSON.parse('[' + calldata + ']');
    const pi_a = proofJson[0];
    const pi_b = proofJson[1];
    const pi_c = proofJson[2];

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
      .map((elt) => elt.substr(2))
      .join('');

    proofEncoded = `0x${proofEncoded}`;

    let tx = await this.contract.batchInsert(
      proofEncoded,
      toFixedHex(input['argsHash'] ?? ''),
      toFixedHex(input['oldRoot']),
      toFixedHex(input['newRoot']),
      input['pathIndices'],
      input['leaves'],
      batchHeight
    );
    return { input, tx };
  }
}
