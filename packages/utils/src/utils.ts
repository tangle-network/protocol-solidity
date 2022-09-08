/* eslint-disable camelcase */
/* eslint-disable sort-keys */
const assert = require('assert');
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { poseidon } from "circomlibjs"
import { groth16 } from "snarkjs"

import { u8aToHex } from '@polkadot/util';

import path from 'path';
import { ZkComponents } from './types';
import { toFixedHex, Keypair, MerkleProof, MerkleTree, Utxo } from '@webb-tools/sdk-core';

export const FIELD_SIZE = BigNumber.from(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

export async function fetchComponentsFromFilePaths(
  wasmPath: string,
  witnessCalculatorPath: string,
  zkeyPath: string
): Promise<ZkComponents> {
  const wasm: Buffer = require('fs').readFileSync(path.resolve(__dirname, wasmPath));
  const witnessCalculatorGenerator = require(witnessCalculatorPath);
  const witnessCalculator = await witnessCalculatorGenerator(wasm);
  const zkeyBuffer: Buffer = require('fs').readFileSync(path.resolve(__dirname, zkeyPath));
  const zkey: Uint8Array = new Uint8Array(
    zkeyBuffer.buffer.slice(zkeyBuffer.byteOffset, zkeyBuffer.byteOffset + zkeyBuffer.byteLength)
  );

  return {
    wasm,
    witnessCalculator,
    zkey,
  };
}

/**
 * Computes the updated chain ID with chain type.
 * @param chainID Chain ID to encode into augmented chain ID Type, defaults to hardhat's chain ID.
 * @returns
 */
export const getChainIdType = (chainID: number = 31337): number => {
  const CHAIN_TYPE = '0x0100';
  const chainIdType = CHAIN_TYPE + toFixedHex(chainID, 4).substr(2);
  return Number(BigInt(chainIdType));
};


export function getIdentityVAnchorExtDataHash (
  encryptedOutput1: string,
  encryptedOutput2: string,
  extAmount: string,
  fee: string,
  recipient: string,
  relayer: string,
  refund: string,
  token: string
) {
  const abi = new ethers.utils.AbiCoder();
  const encodedData = abi.encode(
    ['tuple(address recipient,int256 extAmount,address relayer,uint256 fee,uint256 refund,address token,bytes encryptedOutput1,bytes encryptedOutput2)'],
    [{
      recipient: toFixedHex(recipient, 20),
      extAmount: toFixedHex(extAmount),
      relayer: toFixedHex(relayer, 20),
      fee: toFixedHex(fee),
      refund: toFixedHex(refund),
      token: toFixedHex(token, 20),
      encryptedOutput1,
      encryptedOutput2
    }]
  );

  const hash = ethers.utils.keccak256(encodedData);

  return BigNumber.from(hash).mod(FIELD_SIZE);
}
export default function verifyProof(verificationKey: any, { proof, publicSignals }: any): Promise<boolean> {
    return groth16.verify(
        verificationKey,
        [
            publicSignals.merkleRoot,
            publicSignals.nullifierHash,
            publicSignals.signalHash,
            publicSignals.externalNullifier
        ],
        proof
    )
}

export async function generateProof (
  privateKey: string,
  identityRoots: string[],
  identityMerkleProof: MerkleProof,
  vanchorMerkleProofs: MerkleProof[],
  vanchor_inputs: any,
  wasmFilePath: string,
  zkeyFilePath: string,
): Promise<any> {
  const vanchorProofs = vanchorMerkleProofs.map((proof) => ({
    pathIndex: MerkleTree.calculateIndexFromPathIndices(proof.pathIndices),
    pathElements: proof.pathElements
  }));
  // const identityProof = identityMerkleProofs.map((proof) => ({
  //   pathIndex: proof.pathIndices,
  //   pathElements: proof.pathElements
  // }));
  // assert.strictEqual(identityMerkleProof.element.toBigInt(), poseidon([privateKey]).toBigInt())

  let proof = await groth16.fullProve({
    privateKey: privateKey.toString(),
    semaphoreTreePathIndices: identityMerkleProof.pathIndices,
    semaphoreTreeSiblings: identityMerkleProof.pathElements.map((x) => BigNumber.from(x).toString()),
    semaphoreRoots: identityRoots,
    chainID: vanchor_inputs.chainID,
    publicAmount: vanchor_inputs.publicAmount,
    extDataHash: vanchor_inputs.extDataHash,
    //
    // // data for 2 transaction inputs
    inputNullifier: vanchor_inputs.inputNullifier,
    inAmount: vanchor_inputs.inAmount,
    inPrivateKey: vanchor_inputs.inPrivateKey,
    inBlinding: vanchor_inputs.inBlinding,
    inPathIndices: vanchor_inputs.inPathIndices,
    inPathElements: vanchor_inputs.inPathElements,
    //
    // // data for 2 transaction outputs
    outputCommitment: vanchor_inputs.outputCommitment,
    outChainID: vanchor_inputs.outChainID,
    outAmount: vanchor_inputs.outAmount,
    outPubkey: vanchor_inputs.outPubkey,
    outBlinding: vanchor_inputs.outBlinding,
    vanchorRoots: vanchor_inputs.roots,
  }, wasmFilePath, zkeyFilePath);

  return proof;
}
