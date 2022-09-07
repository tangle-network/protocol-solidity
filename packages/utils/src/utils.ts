/* eslint-disable camelcase */
/* eslint-disable sort-keys */
import { BigNumber, BigNumberish, ethers } from 'ethers';

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

export function generateIdentityVAnchorWitnessInput (
  privateKey: string,
  identityRoots: BigNumber[],
  vanchorRoots: BigNumber[],
  chainId: BigNumberish,
  inputs: Utxo[],
  outputs: Utxo[],
  extAmount: BigNumberish,
  fee: BigNumberish,
  extDataHash: BigNumber,
  identityMerkleProof: MerkleProof,
  vanchorMerkleProofs: MerkleProof[]
): any {
  const keypair1 = new Keypair(outputs[0].secret_key);
  const keypair2 = new Keypair(outputs[1].secret_key);

  const vanchorProofs = vanchorMerkleProofs.map((proof) => ({
    pathIndex: MerkleTree.calculateIndexFromPathIndices(proof.pathIndices),
    pathElements: proof.pathElements
  }));
  // const identityProof = identityMerkleProofs.map((proof) => ({
  //   pathIndex: proof.pathIndices,
  //   pathElements: proof.pathElements
  // }));

  const input = {
    privateKey: privateKey.toString(),
    semaphoreTreePathIndices: identityMerkleProof.pathIndices,
    semaphoreTreeSiblings: identityMerkleProof.pathElements,
    semaphoreRoots: identityRoots.map((x) => x.toString()),
    chainID: chainId.toString(),
    inputNullifier: inputs.map((x) => BigNumber.from(x.nullifier).toString()),
    outputCommitment: outputs.map((x) => BigNumber.from(u8aToHex(x.commitment)).toString()),
    publicAmount: BigNumber.from(extAmount).sub(fee).add(FIELD_SIZE).mod(FIELD_SIZE).toString(),
    extDataHash: extDataHash.toString(),

    // data for 2 transaction inputs
    inAmount: inputs.map((x) => x.amount.toString()),
    inPrivateKey: inputs.map((x) => x.secret_key.toString()),
    inBlinding: inputs.map((x) => BigNumber.from(x.blinding).toString()),
    inPathIndices: vanchorProofs.map((x) => x.pathIndex),
    inPathElements: vanchorProofs.map((x) => x.pathElements),

    // data for 2 transaction outputs
    outChainID: outputs.map((x) => x.chainId),
    outAmount: outputs.map((x) => x.amount.toString()),
    outPubkey: [toFixedHex(keypair1.pubkey), toFixedHex(keypair2.pubkey)],
    outBlinding: outputs.map((x) => BigNumber.from(x.blinding).toString()),
    vanchorRoots: vanchorRoots.map((x) => x.toString())
  };

  return input;
}
