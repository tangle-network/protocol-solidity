// Copyright 2022-2023 Webb Technologies Inc.
// SPDX-License-Identifier: Apache-2.0

//! An example of a serialized note is:
//! webb://v1:vanchor/
//!   1099511707777:1099511627781/
//!   0x38e7aa90c77f86747fab355eecaa0c2e4c3a463d:0x38e7aa90c77f86747fab355eecaa0c2e4c3a463d/
//!   0000010000000005:000000000000000000000000000000000000000000000000002386f26fc10000:01375c5486fdf98350ba7a2ad013f7ea72f1dc6f63a674a9bc295938fa76a44c:00d3f9f63755b6038415db5ad7c0eff1be61a09a9f108f25c59934a7d4d6821c/
//!   ?curve=Bn254&width=5&exp=5&hf=Poseidon&backend=Circom&token=webbAlpha&denom=18&amount=10000000000000000&index=0

import { BigNumberish, BigNumber } from 'ethers';
import { Utxo } from './utxo';
import { randomBN, randomFieldElement, toFixedHex } from '../utils';
import { Keypair } from './keypair';
import { calculateTypedChainIdBytes, parseTypedChainId } from './typed-chain-id';
export type Scheme = 'webb';

export type NoteProtocol = 'vanchor';

// export type Leaves = Array<Uint8Array>;

// export type Indices = Array<number>;

export type HashFunction = 'Poseidon';

export type Curve = 'Bn254';

export type Version = 'v1';

export type Backend = 'Circom' | 'Arkworks';

/**
 * The note input used to generate a `Note` instance.
 *
 * @param protocol - The shielded pool protocol to use.
 * @param version - The version of the note to use.
 * @param sourceChain - The source chain id.
 * @param sourceIdentifyingData - source identifying data.
 * @param targetChain - The target chain id.
 * @param targetIdentifyingData - target identifying data.
 * @param backend - The backend to use. Different values include 'Arkworks' and 'Circom'
 * @param hashFunction - The hash function to use. Different values include 'Poseidon' and 'Pederson'
 * @param curve - The curve to use. Different values include 'Bn254' and 'Bls381'
 * @param tokenSymbol - The token symbol to use.
 * @param amount - The amount to use.
 * @param denomination - The denomination to use. Commonly used denominations include '18' for ETH and '12' for DOT
 * @param width - The width to use. Related to the amount of secret parameters hashed together.
 * @param secrets - Optional secrets to use. When passed, secret generation is skipped for the resulting note instance.
 * @param exponentiation - The exponentiation to use. This is the exponentiation of the SBOX hash function component (for Poseidon)
 * @param index - UTXO index. Useful identifying information for deposits in merkle trees.
 * @param privateKey - Utxo private key used for generation VAnchor notes
 * @param blinding - Utxo blinding value used for generation VAnchor notes
 */
export type NoteGenInput = {
  protocol: NoteProtocol;
  sourceChain: string;
  sourceIdentifyingData: string;
  targetChain: string;
  targetIdentifyingData: string;
  backend: Backend;
  hashFunction: HashFunction;
  curve: Curve;
  tokenSymbol: string;
  amount: string;
  denomination: string;
  width: string;
  exponentiation: string;
  version?: string;
  secrets?: string;
  index?: string;
  privateKey?: Uint8Array;
  blinding?: Uint8Array;
};

enum ErrorCode {
  Unknown = 'Unknown error',
  InvalidHexLength = 'Invalid hex length',
  HexParsingFailed = 'Failed to parse hex',
  InvalidNoteLength = 'Invalid note length',
  InvalidNoteProtocol = 'Invalid note protocol',
  InvalidNoteVersion = 'Invalid note version',
  InvalidNoteId = 'Invalid note id',
  InvalidNoteBlockNumber = 'Invalid block number',
  InvalidNoteSecrets = 'Invalid note secrets',
  MerkleTreeNotFound = 'Merkle tree not found',
  SerializationFailed = 'Failed to serialize',
  DeserializationFailed = 'Failed to deserialize',
  InvalidArrayLength = 'Invalid array length',
  InvalidCurve = 'Invalid curve',
  InvalidHasFunction = 'Invalid hash function',
  InvalidBackend = 'Invalid backend',
  InvalidDenomination = 'Invalid denomination',
  SecretGenFailed = 'Failed to generate secrets',
  InvalidSourceChain = 'Invalid source chain id',
  InvalidTargetChain = 'Invalid target chain id',
  InvalidTokenSymbol = 'Invalid token symbol',
  InvalidExponentiation = 'Invalid exponentiation',
  InvalidWidth = 'Invalid width',
  InvalidAmount = 'Invalid amount',
  InvalidProofParameters = 'Invalid proof parameters',
  InvalidProvingKey = 'Invalid proving key',
  InvalidRecipient = 'Invalid recipient address',
  InvalidRelayer = 'Invalid relayer address',
  InvalidLeafIndex = 'Invalid leaf index',
  InvalidFee = 'Invalid fee',
  InvalidRefund = 'Invalid refund',
  InvalidLeaves = 'Invalid leaves',
  FailedToGenerateTheLeaf = 'Failed to generate the leaf',
  ProofBuilderNoteNotSet = "Proof building failed note isn't set",
  CommitmentNotSet = "Proof building failed refresh commitment isn't set",
  RootsNotSet = "Proof building failed roots array isn't set",
  InvalidNoteMiscData = 'Invalid note misc data',
  InvalidSourceIdentifyingData = 'Invalid source identifying data',
  InvalidTargetIdentifyingData = 'Invalid target identifying data',
  UnsupportedParameterCombination = 'Unsupported Paramater combination to generate proof',
  InvalidProof = 'Proof verification failed',
  InvalidUTXOIndex = 'Invalid UTXO Index value',
  UnsupportedBackend = 'Unsupported backend',
  PublicAmountNotSet = 'VAnchor proof input requires public amount field',
  VAnchorProofChainId = 'VAnchor proof input requires chain id',
  VAnchorNotesNotSet = 'VAnchor proof input requires list of notes',
  VAnchorProofIndices = 'VAnchor proof input require list of indices',
  VAnchorProofLeavesMap = 'VAnchor proof input require leaves  map',
  ProofInputFieldInstantiationError = 'The proof input field installation failed',
  ProofInputFieldInstantiationProtocolInvalid = 'The proof input field installation failed wrong protocol or field',
  InvalidNullifer = 'Invalid nullifer value',
  InvalidRoots = 'Invalid roots value',
  InvalidChainId = 'Invalid chain id',
  InvalidIndices = 'Invalid indices value',
  InvalidPublicAmount = 'Invalid public amount',
  InvalidOutputUtxoConfig = 'Invalid output UTXO config',
  InvalidExtDataHash = 'Invalid external data hash',
  InvalidInputUtxoConfig = 'Invalid input UTXO config',
}

class SerializationError extends Error {
  code: ErrorCode;
  data: any;
  message: string;

  constructor(code: ErrorCode, data: any, message: string) {
    super(message);
    this.code = code;
    this.data = data;
    this.message = message;
  }
}

function handleError(e: any) {
  if (e instanceof SerializationError) {
    return Promise.reject({
      code: e.code,
      data: e.data,
      message: e.message,
    });
  } else {
    return Promise.reject({
      code: 'UnknownError',
      data: e,
      message: 'Unknown error',
    });
  }
}

/**
 * Note class using the WebAssembly note backend.
 *
 * The goal of this class is to provide a Note interface
 * that works both in Node.js and in the browser.
 */
export class Note {
  static CURRENT_VERSION: Version = 'v1';

  scheme: Scheme;
  protocol: NoteProtocol;
  version: Version;
  sourceChainId: string;
  targetChainId: string;
  sourceIdentifyingData: string;
  targetIdentifyingData: string;
  secrets: Array<string>;
  curve: Curve;
  exponentiation: string;
  width: string;
  tokenSymbol: string;
  amount: BigNumberish;
  denomination: string;
  backend: Backend;
  hashFunction: HashFunction;
  index: string;
  utxo: Utxo;

  // Default constructor
  constructor(noteInput: NoteGenInput) {
    this.scheme = 'webb';
    this.protocol = noteInput.protocol;
    this.version = Note.CURRENT_VERSION;
    this.sourceChainId = noteInput.sourceChain;
    this.targetChainId = noteInput.targetChain;
    this.sourceIdentifyingData = noteInput.sourceIdentifyingData;
    this.targetIdentifyingData = noteInput.targetIdentifyingData;
    this.secrets = noteInput.secrets ? noteInput.secrets.split(':') : [];
    this.curve = noteInput.curve;
    this.exponentiation = noteInput.exponentiation;
    this.width = noteInput.width;
    this.tokenSymbol = noteInput.tokenSymbol;
    this.amount = noteInput.amount;
    this.denomination = noteInput.denomination;
    this.backend = noteInput.backend;
    this.hashFunction = noteInput.hashFunction;
    this.index = noteInput.index;

    let blinding = noteInput.blinding ? noteInput.blinding : randomFieldElement(32);
    let privateKey = noteInput.privateKey ? noteInput.privateKey : randomFieldElement(32);
    let keypair = new Keypair(`0x${Buffer.from(privateKey).toString('hex')}`);

    if (this.secrets.length === 0) {
      this.secrets = [
        calculateTypedChainIdBytes(Number(this.targetChainId)),
        toFixedHex(this.amount, 32).slice(2),
        Buffer.from(privateKey).toString().slice(2),
        Buffer.from(blinding).toString().slice(2),
      ];
    }

    this.utxo = Utxo.generateUtxo({
      curve: this.curve,
      backend: this.backend,
      amount: this.amount,
      chainId: this.targetChainId,
      blinding: blinding,
      index: this.index,
      keypair: keypair,
      originChainId: this.sourceChainId,
    });
    return this;
  }

  /**
   * Deserializes a note from a string.
   *
   * @param value - A serialized note.
   * @returns A note class instance.
   */
  public static deserialize(value: string): Note {
    try {
      let schemeAndParts = value.split('://');
      let scheme = schemeAndParts[0];
      // Check scheme
      if (scheme !== 'webb') {
        throw new SerializationError(ErrorCode.Unknown, scheme, `Unknown scheme ${scheme}`);
      }
      // Check parts length
      let parts = schemeAndParts[1].split('/');
      if (parts.length < 5) {
        throw new SerializationError(
          ErrorCode.InvalidNoteLength,
          parts,
          `Expected at least 5 parts, got ${parts.length}`
        );
      }
      // Check note parts
      let versioning = parts[0];
      let chain_ids = parts[1];
      let chainIdentifyingData = parts[2];
      let secrets = parts[3];
      let misc = parts[4].replace('?', '');
      // Parse version/protocol part
      let versioningParts = versioning.split(':');
      if (versioningParts.length !== 2) {
        throw new SerializationError(
          ErrorCode.InvalidNoteLength,
          versioning,
          `Expected at least 2 versioning parts, got ${versioningParts.length}`
        );
      }
      let version = versioningParts[0];
      let protocol = versioningParts[1];
      if (version !== Note.CURRENT_VERSION) {
        throw new SerializationError(
          ErrorCode.InvalidNoteVersion,
          version,
          `Expected version ${Note.CURRENT_VERSION}, got ${version}`
        );
      }
      if (protocol !== 'vanchor') {
        throw new SerializationError(
          ErrorCode.InvalidNoteProtocol,
          protocol,
          `Expected protocol vanchor, got ${protocol}`
        );
      }
      // Parse source / target chain ids
      let chainIdsParts = chain_ids.split(':');
      if (chainIdsParts.length !== 2) {
        throw new SerializationError(
          ErrorCode.InvalidNoteLength,
          chain_ids,
          `Expected at least 2 chain ids parts, got ${chainIdsParts.length}`
        );
      }
      let sourceChainId = chainIdsParts[0];
      let targetChainId = chainIdsParts[1];
      // Parse source / target chain identifying data
      let chainIdentifyingDataParts = chainIdentifyingData.split(':');
      if (chainIdentifyingDataParts.length !== 2) {
        throw new SerializationError(
          ErrorCode.InvalidNoteLength,
          chainIdentifyingData,
          `Expected at least 2 chain identifying data parts, got ${chainIdentifyingDataParts.length}`
        );
      }
      let sourceIdentifyingData = chainIdentifyingDataParts[0];
      let targetIdentifyingData = chainIdentifyingDataParts[1];
      // Misc data parsing
      let miscParts = misc.split('&');
      let curve,
        width,
        exponentiation,
        hashFunction,
        backend,
        tokenSymbol,
        denomination,
        amount,
        index;

      for (let i = 0; i < miscParts.length; i++) {
        let miscPart = miscParts[i];
        let miscPartItems = miscPart.split('=');
        if (miscPartItems.length !== 2) {
          throw new SerializationError(
            ErrorCode.InvalidNoteMiscData,
            miscPart,
            `Expected at least 2 misc data parts, got ${miscPartItems.length}`
          );
        }

        let miscPartKey = miscPartItems[0];
        let miscPartValue = miscPartItems[1];
        switch (miscPartKey) {
          case 'curve':
            curve = miscPartValue;
            break;
          case 'width':
            width = miscPartValue;
            break;
          case 'exp':
            exponentiation = miscPartValue;
            break;
          case 'hf':
            hashFunction = miscPartValue;
            break;
          case 'backend':
            backend = miscPartValue;
            break;
          case 'token':
            tokenSymbol = miscPartValue;
            break;
          case 'denom':
            denomination = miscPartValue;
            break;
          case 'amount':
            amount = miscPartValue;
            break;
          case 'index':
            index = miscPartValue;
            break;
          default:
            throw new SerializationError(
              ErrorCode.InvalidNoteMiscData,
              miscPartKey,
              `Unknown misc data key ${miscPartKey}`
            );
        }
      }

      let secretsParts = secrets.split(':');
      if (secretsParts.length !== 4) {
        throw new SerializationError(
          ErrorCode.InvalidNoteSecrets,
          secrets,
          `Expected 4 secrets parts, got ${secretsParts.length}`
        );
      }
      let privateKey = secretsParts[2];
      let blinding = secretsParts[3];

      let noteGenInput: NoteGenInput = {
        protocol: protocol,
        version: version,
        sourceChain: sourceChainId,
        sourceIdentifyingData: sourceIdentifyingData,
        targetChain: targetChainId,
        targetIdentifyingData: targetIdentifyingData,
        backend: backend || 'Circom',
        hashFunction: hashFunction || 'Poseidon',
        curve: curve || 'Bn254',
        tokenSymbol: tokenSymbol || '',
        amount: amount || '',
        denomination: denomination || '',
        width: width || '',
        exponentiation: exponentiation || '',
        secrets: secrets,
        index: index || '',
        privateKey: Buffer.from(privateKey, 'hex'),
        blinding: Buffer.from(blinding, 'hex'),
      };

      return new Note(noteGenInput);
    } catch (e: any) {
      handleError(e);
    }
  }

  /**
   * Serializes the note to a string.
   *
   * @returns The serialized note.
   */
  public serialize(): string {
    let schemeAndVersion = `${this.scheme}://${this.version}:${this.protocol}/`;
    let chainIds = `${this.sourceChainId}:${this.targetChainId}/`;
    let chainIdentifyingData = `${this.sourceIdentifyingData}:${this.targetIdentifyingData}/`;
    let secrets = `${this.secrets.join(':')}/`;
    let miscParts = [];
    if (this.curve) {
      miscParts.push(`curve=${this.curve}`);
    }
    if (this.width) {
      miscParts.push(`width=${this.width}`);
    }
    if (this.exponentiation) {
      miscParts.push(`exp=${this.exponentiation}`);
    }
    if (this.hashFunction) {
      miscParts.push(`hf=${this.hashFunction}`);
    }
    if (this.backend) {
      miscParts.push(`backend=${this.backend}`);
    }
    if (this.tokenSymbol) {
      miscParts.push(`token=${this.tokenSymbol}`);
    }
    if (this.denomination) {
      miscParts.push(`denom=${this.denomination}`);
    }
    if (this.amount) {
      miscParts.push(`amount=${this.amount}`);
    }
    if (this.index) {
      miscParts.push(`index=${this.index}`);
    }
    let misc = `?${miscParts.join('&')}`;
    return `${schemeAndVersion}${chainIds}${chainIdentifyingData}${secrets}${misc}`;
  }

  /**
   * Calls the webassembly JsNote's mutate index to change the index.
   *
   * @returns void
   */
  mutateIndex(index: string) {
    this.index = index;
  }

  /**
   * Gets the leaf commitment of the note depending
   * on the protocol.
   *
   * @returns Returns the leaf commitment of the note.
   */
  getLeaf(): Uint8Array {
    return this.utxo.commitment;
  }

  /**
   * Generates a note using the relevant input data. Supports
   * the protocols defined in the WebAssembly note backend.
   *
   * ```typescript
   * // Generate an anchor note
   * const input: NoteGenInput = {
   *   protocol: 'vanchor',
   *   version: 'v1',
   *   targetChain: '1',
   *   targetIdentifyingData: '1',
   *   sourceChain: '1',
   *   sourceIdentifyingData: '1',
   *   backend: 'Circom',
   *   hashFunction: 'Poseidon',
   *   curve: 'Bn254',
   *   tokenSymbol: 'WEBB',
   *   amount: '1',
   *   denomination: '18',
   *   width: '4',
   *   exponentiation: '5',
   * }
   *
   * const note = await Note.generateNote(input);
   * ```
   * @param noteGenInput - The input data for generating a note.
   * @returns
   */
  public static generateNote(noteGenInput: NoteGenInput): Note {
    return new Note(noteGenInput);
  }
}
