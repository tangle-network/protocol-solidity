import { VAnchor } from "@webb-tools/anchors";

import { BigNumber, BigNumberish, ethers } from 'ethers';
import {
  toFixedHex,
  Utxo,
  CircomProvingManager,
  ProvingManagerSetupInput,
  Note,
  NoteGenInput,
  FIELD_SIZE,
} from '@webb-tools/sdk-core';
import {
  IVariableAnchorExtData,
  IVariableAnchorPublicInputs,
} from '@webb-tools/interfaces';
import { hexToU8a, u8aToHex, getChainIdType, ZkComponents } from '@webb-tools/utils';
import { VAnchor as VAnchorContract } from "@webb-tools/contracts";

export class SetupTxVAnchorMock extends VAnchor {
  private rootsForProof: string[];

  constructor(
    contract: VAnchorContract,
    signer: ethers.Signer,
    treeHeight: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    roots: string[]
  ) {
    super(contract, signer, treeHeight, maxEdges, smallCircuitZkComponents, largeCircuitZkComponents);
    this.rootsForProof = roots;
  }

  public async setupTransaction(
    inputs: Utxo[],
    outputs: [Utxo, Utxo],
    extAmount: BigNumberish,
    fee: BigNumberish,
    refund: BigNumberish,
    token: string,
    recipient: string,
    relayer: string,
    leavesMap: Record<string, Uint8Array[]>
  ) {
    // first, check if the merkle root is known on chain - if not, then update
    const chainId = getChainIdType(await this.signer.getChainId());

    // calculate the sum of input notes (for calculating the public amount)
    let sumInputs: BigNumberish = 0;
    let inputIndices: number[] = [];

    for (const inputUtxo of inputs) {
      sumInputs = BigNumber.from(sumInputs).add(inputUtxo.amount);
      inputIndices.push(inputUtxo.index);
    }

    const encryptedCommitments: [Uint8Array, Uint8Array] = [
      hexToU8a(outputs[0].encrypt()),
      hexToU8a(outputs[1].encrypt()),
    ];

    const proofInput: ProvingManagerSetupInput<'vanchor'> = {
      inputUtxos: inputs,
      leavesMap,
      indices: inputIndices,
      roots: this.rootsForProof.map((root) => hexToU8a(root)),
      chainId: chainId.toString(),
      output: outputs,
      encryptedCommitments,
      publicAmount: BigNumber.from(extAmount).sub(fee).add(FIELD_SIZE).mod(FIELD_SIZE).toString(),
      provingKey: inputs.length > 2 ? this.largeCircuitZkComponents.zkey : this.smallCircuitZkComponents.zkey,
      relayer: hexToU8a(relayer),
      refund: BigNumber.from(refund).toString(),
      token: hexToU8a(token),
      recipient: hexToU8a(recipient),
      extAmount: toFixedHex(BigNumber.from(extAmount)),
      fee: BigNumber.from(fee).toString(),
    };

    inputs.length > 2
      ? (this.provingManager = new CircomProvingManager(this.largeCircuitZkComponents.wasm, this.tree.levels, null))
      : (this.provingManager = new CircomProvingManager(this.smallCircuitZkComponents.wasm, this.tree.levels, null));

    const proof = await this.provingManager.prove('vanchor', proofInput);

    const publicInputs: IVariableAnchorPublicInputs = this.generatePublicInputs(
      proof.proof,
      this.rootsForProof,
      inputs,
      outputs,
      proofInput.publicAmount,
      u8aToHex(proof.extDataHash)
    );

    const extData: IVariableAnchorExtData = {
      recipient: toFixedHex(proofInput.recipient, 20),
      extAmount: toFixedHex(proofInput.extAmount),
      relayer: toFixedHex(proofInput.relayer, 20),
      fee: toFixedHex(proofInput.fee),
      refund: toFixedHex(proofInput.refund),
      token: toFixedHex(proofInput.token, 20),
      encryptedOutput1: u8aToHex(proofInput.encryptedCommitments[0]),
      encryptedOutput2: u8aToHex(proofInput.encryptedCommitments[1]),
    };

    return {
      extData,
      publicInputs,
    };
  }
}
