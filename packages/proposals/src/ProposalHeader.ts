import { u8aToHex } from '@webb-tools/utils';
import { BE } from './';
import { IResourceId, ResourceId } from './ResourceId';

/**
 * Proposal Header is the first 40 bytes of any proposal and it contains the following information:
 * - resource id (32 bytes)
 * - target function signature (4 bytes)
 * - nonce (4 bytes).
 */
export interface IProposalHeader {
  /**
   * 32 bytes ResourceId
   */
  readonly resourceId: IResourceId;
  /**
   * 4 bytes function signature / function identifier
   */
  readonly functionSignature: Uint8Array;
  /**
   * 4 bytes Hex-encoded string of the `nonce` for this proposal.
   */
  readonly nonce: number;
}

/**
 * Proposal Header class
 */
export class ProposalHeader implements IProposalHeader {
  resourceId: IResourceId;
  functionSignature: Uint8Array;
  nonce: number;

  constructor(resourceId: IResourceId, functionSignature: Uint8Array, nonce: number) {
    this.resourceId = resourceId;
    this.functionSignature = functionSignature;
    this.nonce = nonce;
  }

  /**
   * Converts a 40-byte Uint8Array into a proposal header.
   */
  static fromBytes(bytes: Uint8Array): ProposalHeader {
    if (bytes.length !== 40) {
      throw new Error('bytes must be 40 bytes');
    }

    const resourceId = ResourceId.fromBytes(bytes.slice(0, 32));
    const functionSignature = bytes.slice(32, 36);
    const nonce = new DataView(bytes.buffer).getUint32(36, BE);

    return new ProposalHeader(resourceId, functionSignature, nonce);
  }

  /**
   * Converts the proposal header into a 40-byte Uint8Array.
   */
  toU8a(): Uint8Array {
    const proposalHeader = new Uint8Array(40);

    proposalHeader.set(this.resourceId.toU8a(), 0);
    proposalHeader.set(this.functionSignature.slice(0, 4), 32);
    const buf = Buffer.allocUnsafe(4);

    buf.writeUInt32BE(this.nonce, 0);

    proposalHeader.set(buf, 36);

    return proposalHeader;
  }

  /**
   * Converts the proposal header into a 40-byte Hex-encoded string.
   */
  toString(): string {
    return u8aToHex(this.toU8a());
  }
}
