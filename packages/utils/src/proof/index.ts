export * from './variable-anchor.js';
export * from './build-variable-witness.js';

import { ethers } from 'ethers';
import { p256 } from '../utils';

export type Proof = {
  pi_a: string[3];
  pi_b: Array<string[2]>;
  pi_c: string[3];
  protocol: string;
  curve: string;
};

export type VAnchorProofInputs = {
  roots: string[];
  chainID: string;
  inputNullifier: string[];
  outputCommitment: string[];
  publicAmount: string;
  extDataHash: string;

  // data for 2 transaction inputs
  inAmount: string[];
  inPrivateKey: string[];
  inBlinding: string[];
  inPathIndices: number[][];
  inPathElements: number[][];

  // data for 2 transaction outputs
  outChainID: string;
  outAmount: string[];
  outPubkey: string[];
  outBlinding: string[];
};

export function groth16ExportSolidityCallData(proof: any, pub: any) {
  let inputs = '';

  for (let i = 0; i < pub.length; i++) {
    if (inputs !== '') {
      inputs = inputs + ',';
    }

    inputs = inputs + p256(pub[i]);
  }

  const S =
    `[${p256(proof.pi_a[0])}, ${p256(proof.pi_a[1])}],` +
    `[[${p256(proof.pi_b[0][1])}, ${p256(proof.pi_b[0][0])}],[${p256(proof.pi_b[1][1])}, ${p256(
      proof.pi_b[1][0]
    )}]],` +
    `[${p256(proof.pi_c[0])}, ${p256(proof.pi_c[1])}],` +
    `[${inputs}]`;

  return S;
}

export function generateWithdrawProofCallData(proof: any, publicSignals: any) {
  const result = groth16ExportSolidityCallData(proof, publicSignals);
  const fullProof = JSON.parse('[' + result + ']');
  const pi_a = fullProof[0];
  const pi_b = fullProof[1];
  const pi_c = fullProof[2];

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

export const generateFunctionSigHash = (functionSignature: string): string => {
  return ethers.utils
    .keccak256(ethers.utils.toUtf8Bytes(functionSignature))
    .slice(0, 10)
    .padEnd(10, '0');
};
