/* eslint-disable camelcase */
/* eslint-disable sort-keys */
import { BigNumber } from 'ethers';
import { groth16 } from 'snarkjs';

import { toFixedHex } from '@webb-tools/sdk-core';

export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const FIELD_SIZE = BigNumber.from(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

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

export default function verifyProof(
  verificationKey: any,
  { proof, publicSignals }: any
): Promise<boolean> {
  return groth16.verify(
    verificationKey,
    [
      publicSignals.merkleRoot,
      publicSignals.nullifierHash,
      publicSignals.signalHash,
      publicSignals.externalNullifier,
    ],
    proof
  );
}
