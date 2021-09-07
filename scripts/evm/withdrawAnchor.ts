require('dotenv').config({ path: '../.env' });
import { ethers } from 'ethers';
import { AnchorBase2__factory } from '../../typechain/factories/AnchorBase2__factory';
import { getAnchorLeaves } from './getAnchorLeaves';
import { parseNote } from './parseNote';

const MerkleTree = require('../../lib/MerkleTree');
const snarkjs = require('snarkjs');
const F = require('circomlib').babyJub.F;
const helpers = require('../../test/helpers');
const Scalar = require("ffjavascript").Scalar;
const BN = require('bn.js');
const path = require('path');

const createWitness = async (data: any) => {
  const wtns = {type: "mem"};
  await snarkjs.wtns.calculate(data, path.join(
    "..",
    "test",
    "fixtures",
    "poseidon_bridge_2.wasm"
  ), wtns);
  return wtns;
}

export async function withdrawAnchor(anchorAddress: string, tokenAddress: string, note: string, recipient: string, passedWallet: ethers.Signer) {
  const chainId = await passedWallet.getChainId();
  const walletAddress = await passedWallet.getAddress();
  const anchor = AnchorBase2__factory.connect(anchorAddress, passedWallet);
  const treeHeight = await anchor.levels();
  const leaves = await getAnchorLeaves(anchor.address, passedWallet.provider!);

  const deposit = parseNote(note);
  const tree = new MerkleTree(treeHeight, leaves, null);
  
  if (deposit) {
    let leafIndex = leaves.findIndex(commitment => commitment === helpers.toFixedHex(deposit.commitment));
    const merkleInputs = await tree.path(leafIndex);

    const input = {
      // public
      nullifierHash: deposit.nullifierHash,
      recipient,
      relayer: recipient,
      fee: BigInt((new BN('0')).toString()),
      refund: BigInt((new BN('0')).toString()),
      chainID: deposit.chainID,
      roots: [merkleInputs.root, 0],
      // private
      nullifier: deposit.nullifier,
      secret: deposit.secret,
      pathElements: merkleInputs.path_elements,
      pathIndices: merkleInputs.path_index,
      diffs: [merkleInputs.root, 0].map(r => {
        return F.sub(
          Scalar.fromString(`${r}`),
          Scalar.fromString(`${merkleInputs.root}`),
        ).toString();
      }),
    };

    console.log(input);

    const wtns = await createWitness(input);

    let res = await snarkjs.groth16.prove('../test/fixtures/circuit_final.zkey', wtns);
    const proof = res.proof;
    const publicSignals = res.publicSignals;

    const proofEncoded = await helpers.generateWithdrawProofCallData(proof, publicSignals);
    
    const tx = await anchor.withdraw(
      `0x${proofEncoded}`,
      helpers.createRootsBytes(input.roots),
      helpers.toFixedHex(input.nullifierHash),
      helpers.toFixedHex(input.recipient, 20),
      helpers.toFixedHex(input.relayer, 20),
      input.fee,
      input.refund,
      { gasLimit: '0x989680' }
    );
    const receipt = await tx.wait();
    console.log(receipt);
  }

  return deposit;
}

