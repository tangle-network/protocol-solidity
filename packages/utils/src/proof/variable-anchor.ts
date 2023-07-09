/* eslint-disable camelcase */
/* eslint-disable sort-keys */
import { BigNumber, BigNumberish, ethers } from 'ethers';

import { u8aToHex } from '@polkadot/util';

import { toFixedHex } from '../utils';
import { FIELD_SIZE } from '../protocol';
import { Utxo } from '../protocol/utxo';
import { MerkleProof, MerkleTree } from '../protocol/merkle-tree';

export function getVAnchorExtDataHash(
  encryptedOutput1: string,
  encryptedOutput2: string,
  extAmount: string,
  fee: string,
  recipient: string,
  relayer: string,
  refund: string,
  token: string
): BigNumberish {
  const abi = new ethers.utils.AbiCoder();
  const encodedData = abi.encode(
    [
      'tuple(address recipient,int256 extAmount,address relayer,uint256 fee,uint256 refund,address token,bytes encryptedOutput1,bytes encryptedOutput2)',
    ],
    [
      {
        recipient: toFixedHex(recipient, 20),
        extAmount: toFixedHex(extAmount),
        relayer: toFixedHex(relayer, 20),
        fee: toFixedHex(fee),
        refund: toFixedHex(refund),
        token: toFixedHex(token, 20),
        encryptedOutput1,
        encryptedOutput2,
      },
    ]
  );

  const hash = ethers.utils.keccak256(encodedData);

  return BigNumber.from(hash).mod(FIELD_SIZE);
}

export function generateVariableWitnessInput(
  roots: BigNumberish[],
  chainId: BigNumberish,
  inputs: Utxo[],
  outputs: Utxo[],
  extAmount: BigNumberish,
  fee: BigNumberish,
  extDataHash: BigNumberish,
  externalMerkleProofs: MerkleProof[]
): any {
  const vanchorMerkleProofs = externalMerkleProofs.map((proof) => ({
    pathIndex: MerkleTree.calculateIndexFromPathIndices(proof.pathIndices),
    pathElements: proof.pathElements,
  }));

  const input = {
    roots: roots.map((x) => x.toString()),
    chainID: chainId.toString(),
    inputNullifier: inputs.map((x) => '0x' + x.nullifier),
    outputCommitment: outputs.map((x) => BigNumber.from(u8aToHex(x.commitment)).toString()),
    publicAmount: BigNumber.from(extAmount).sub(fee).add(FIELD_SIZE).mod(FIELD_SIZE).toString(),
    extDataHash: extDataHash.toString(),

    // data for 2 transaction inputs
    inAmount: inputs.map((x) => x.amount.toString()),
    inPrivateKey: inputs.map((x) => '0x' + x.secret_key),
    inBlinding: inputs.map((x) => BigNumber.from('0x' + x.blinding).toString()),
    inPathIndices: vanchorMerkleProofs.map((x) => x.pathIndex),
    inPathElements: vanchorMerkleProofs.map((x) => x.pathElements),

    // data for 2 transaction outputs
    outChainID: outputs.map((x) => x.chainId),
    outAmount: outputs.map((x) => x.amount.toString()),
    outPubkey: outputs.map((x) => BigNumber.from(x.getKeypair().getPubKey()).toString()),
    outBlinding: outputs.map((x) => BigNumber.from('0x' + x.blinding).toString()),
  };

  return input;
}
