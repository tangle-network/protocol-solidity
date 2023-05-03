import {
  ProxiedBatchTree as ProxiedBatchTreeContract,
  ProxiedBatchTree__factory,
} from '@webb-tools/masp-anchor-contracts';
import { FIELD_SIZE, MerkleTree, toBuffer } from '@webb-tools/sdk-core';
import { BigNumber, ethers } from 'ethers';
import { ZkComponents } from '@webb-tools/utils';
import jsSHA from 'jssha';

const assert = require('assert');
const snarkjs = require('snarkjs');

type ProofSignals = {
  oldRoot: string;
  newRoot: string;
  pathIndices: number;
  pathElements: string[];
  leaves: string[];
  argsHash?: string;
};

export class ProxiedBatchTree {
  signer: ethers.Signer;
  contract: ProxiedBatchTreeContract;
  tree: MerkleTree;
  // hex string of the connected root
  latestSyncedBlock: number;
  zkComponents_4: ZkComponents;
  zkComponents_8: ZkComponents;
  zkComponents_16: ZkComponents;
  zkComponents_32: ZkComponents;

  constructor(
    contract: ProxiedBatchTreeContract,
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

  public static async createProxiedBatchTree(
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
    const factory = new ProxiedBatchTree__factory(signer);
    const contract = await factory.deploy(levels, hasherAddr, verifierAddr, proxyAddr);
    await contract.deployed();

    const createdProxiedBatchTree = new ProxiedBatchTree(
      contract,
      signer,
      levels,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32
    );
    createdProxiedBatchTree.latestSyncedBlock = contract.deployTransaction.blockNumber!;
    return createdProxiedBatchTree;
  }

  public static async connect(
    contractAddr: string,
    zkComponents_4: ZkComponents,
    zkComponents_8: ZkComponents,
    zkComponents_16: ZkComponents,
    zkComponents_32: ZkComponents,
    signer: ethers.Signer
  ) {
    const factory = new ProxiedBatchTree__factory(signer);
    const proxiedBatchTreeContract = factory.attach(contractAddr);
    const levels = await proxiedBatchTreeContract.levels();
    const createdProxiedBatchTree = new ProxiedBatchTree(
      proxiedBatchTreeContract,
      signer,
      levels,
      zkComponents_4,
      zkComponents_8,
      zkComponents_16,
      zkComponents_32
    );
    return createdProxiedBatchTree;
  }

  public static hashInputs(input: ProofSignals) {
    const sha = new jsSHA('SHA-256', 'ARRAYBUFFER');
    sha.update(toBuffer(BigNumber.from(input.oldRoot).mod(FIELD_SIZE), 32));
    sha.update(toBuffer(BigNumber.from(input.newRoot).mod(FIELD_SIZE), 32));
    sha.update(toBuffer(input.pathIndices, 4));

    for (let i = 0; i < input.leaves.length; i++) {
      sha.update(toBuffer(BigNumber.from(input.leaves[i]).mod(FIELD_SIZE), 32));
    }

    const hash = '0x' + sha.getHash('HEX');
    const result = BigNumber.from(hash).mod(FIELD_SIZE).toString();
    return result;
  }

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
    let batchPathElements: string[] = pathElements.slice(batchHeight).map((e) => e.toString());
    let batchPathIndices: number = MerkleTree.calculateIndexFromPathIndices(
      pathIndices.slice(batchHeight)
    );
    // pathIndices = MerkleTree.calculateIndexFromPathIndices(pathIndices.slice(batchHeight));
    const input: ProofSignals = {
      oldRoot,
      newRoot,
      pathIndices: batchPathIndices,
      pathElements: batchPathElements,
      leaves,
    };

    input['argsHash'] = ProxiedBatchTree.hashInputs(input);

    const wtns = await zkComponent.witnessCalculator.calculateWTNSBin(input, 0);

    const res = await snarkjs.groth16.prove(zkComponent.zkey, wtns);

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

    const vKey = await snarkjs.zKey.exportVerificationKey(zkComponent.zkey);
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, res.proof);
    assert(verified, true);
    return { input, proof, publicSignals };
  }
}
