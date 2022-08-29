import { IdentityVAnchor } from "@webb-tools/anchors";

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
  IIdentityVariableAnchorExtData,
  IIdentityVariableAnchorPublicInputs,
} from '@webb-tools/interfaces';
import { hexToU8a, u8aToHex, getChainIdType, ZkComponents } from '@webb-tools/utils';
import { IdentityVAnchor as IdentityVAnchorContract } from "@webb-tools/contracts";

export class SetupTxIdentityVAnchorMock extends IdentityVAnchor {
  private identityRootsForProof: string[];
  private vanchorRootsForProof: string[];

  constructor(
    contract: IdentityVAnchorContract,
    signer: ethers.Signer,
    treeHeight: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    identityRoots: string[],
    vanchorRoots: string[]
  ) {
    super(contract, signer, treeHeight, maxEdges, smallCircuitZkComponents, largeCircuitZkComponents);
    this.identityRootsForProof = identityRoots;
    this.vanchorRootsForProof = vanchorRoots;
  }

  public async setupTransaction(
    inputs: Utxo[],
    outputs: [Utxo, Utxo],
    extAmount: BigNumberish,
    fee: BigNumberish,
    recipient: string,
    relayer: string,
    leavesMap: Record<string, Uint8Array[]>
  ) {
    // first, check if the merkle root is known on chain - if not, then update
    const chainId = getChainIdType(await this.signer.getChainId());

    // Start creating notes to satisfy vanchor input
    // Only the sourceChainId and secrets (amount, nullifier, secret, blinding)
    // is required
    let inputNotes: Note[] = [];
    let inputIndices: number[] = [];

    // calculate the sum of input notes (for calculating the public amount)
    let sumInputNotes: BigNumberish = 0;

    for (const inputUtxo of inputs) {
      sumInputNotes = BigNumber.from(sumInputNotes).add(inputUtxo.amount);

      // secrets should be formatted as expected in the wasm-utils for note generation
      const secrets =
        `${toFixedHex(inputUtxo.chainId, 8).slice(2)}:` +
        `${toFixedHex(inputUtxo.amount).slice(2)}:` +
        `${toFixedHex(inputUtxo.secret_key).slice(2)}:` +
        `${toFixedHex(inputUtxo.blinding).slice(2)}`;

      const noteInput: NoteGenInput = {
        amount: inputUtxo.amount.toString(),
        backend: 'Circom',
        curve: 'Bn254',
        denomination: '18', // assumed erc20
        exponentiation: '5',
        hashFunction: 'Poseidon',
        index: inputUtxo.index,
        protocol: 'identityVAnchor',
        secrets,
        sourceChain: inputUtxo.originChainId.toString(),
        sourceIdentifyingData: '0',
        targetChain: chainId.toString(),
        targetIdentifyingData: this.contract.address,
        tokenSymbol: this.token,
        width: '5',
      };
      const inputNote = await Note.generateNote(noteInput);
      inputNotes.push(inputNote);
      inputIndices.push(inputUtxo.index);
    }

    const encryptedCommitments: [Uint8Array, Uint8Array] = [
      hexToU8a(outputs[0].encrypt()),
      hexToU8a(outputs[1].encrypt()),
    ];

    const proofInput: ProvingManagerSetupInput<'identityVAnchor'> = {
      inputNotes,
      leavesMap,
      indices: inputIndices,
      identityRoots: this.identityRootsForProof.map((root) => hexToU8a(root)),
      vanchorRoots: this.vanchorRootsForProof.map((root) => hexToU8a(root)),
      chainId: chainId.toString(),
      output: outputs,
      encryptedCommitments,
      publicAmount: BigNumber.from(extAmount).sub(fee).add(FIELD_SIZE).mod(FIELD_SIZE).toString(),
      provingKey: inputs.length > 2 ? this.largeCircuitZkComponents.zkey : this.smallCircuitZkComponents.zkey,
      relayer: hexToU8a(relayer),
      recipient: hexToU8a(recipient),
      extAmount: toFixedHex(BigNumber.from(extAmount)),
      fee: BigNumber.from(fee).toString(),
    };

    inputs.length > 2
      ? (this.provingManager = new CircomProvingManager(this.largeCircuitZkComponents.wasm, this.tree.levels, null))
      : (this.provingManager = new CircomProvingManager(this.smallCircuitZkComponents.wasm, this.tree.levels, null));

    const proof = await this.provingManager.prove('identityVAnchor', proofInput);

    const publicInputs: IIdentityVariableAnchorPublicInputs = this.generatePublicInputs(
      proof.proof,
      this.identityRootsForProof,
      this.vanchorRootsForProof,
      inputs,
      outputs,
      proofInput.publicAmount,
      u8aToHex(proof.extDataHash)
    );

    const extData: IIdentityVariableAnchorExtData = {
      recipient: toFixedHex(proofInput.recipient, 20),
      extAmount: toFixedHex(proofInput.extAmount),
      relayer: toFixedHex(proofInput.relayer, 20),
      fee: toFixedHex(proofInput.fee),
      encryptedOutput1: u8aToHex(proofInput.encryptedCommitments[0]),
      encryptedOutput2: u8aToHex(proofInput.encryptedCommitments[1]),
    };

    return {
      extData,
      publicInputs,
    };
  }
}
