import { assert, hexToU8a, u8aToHex } from '@polkadot/util';

import { castToChainType, ChainType } from '@webb-tools/utils';
import { BE } from './index';

/**
 * Resource ID is an identifier of a resource in the Webb system.
 * A resource is any piece of code / logic that maintains state and
 * has its state updated over time.
 *
 * We use the resource ID to identify the resource in proposals that
 * is being updated or being referenced in an update to another resource.
 */
export interface IResourceId {
  /**
   * The target system of the resource ID. This represents currently
   * a 26-byte buffer representing a contract address or pallet and tree indicator.
   * @example '0x000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
   * @example '0x0000000000000000000000000000000000000000000000002301'
   */
  readonly targetSystem: Uint8Array;

  /**
   * 2 bytes (u16) encoded as the last 2 bytes of the resource id **just** before the chainId.
   *
   * **Note**: this value is optional here since we can read it from the `ResourceID`, but would be provided for you if
   * you want to decode the proposal header from bytes.
   */
  readonly chainType: ChainType;

  /**
   * 4 bytes number (u32) of the `chainId` this also encoded in the last 4 bytes of the `ResourceID`.
   *
   * **Note**: this value is optional here since we can read it from the `ResourceID`, but would be provided for you if
   * you want to decode the proposal header from bytes.
   */
  readonly chainId: number;

  toU8a(): Uint8Array;
  toString(): string;
}

export class ResourceId implements IResourceId {
  targetSystem: Uint8Array;
  chainType: ChainType;
  chainId: number;

  constructor(targetSystem: string | Uint8Array, chainType: ChainType, chainId: number) {
    if (typeof targetSystem === 'string') {
      const temp = hexToU8a(targetSystem);

      if (temp.length < 26) {
        this.targetSystem = new Uint8Array(26);
        this.targetSystem.set(temp, 6);
      } else {
        this.targetSystem = temp;
      }
    } else {
      this.targetSystem = targetSystem;
    }

    assert(this.targetSystem.length === 26, 'targetSystem must be 26 bytes');
    this.chainType = chainType;
    this.chainId = chainId;
  }

  /**
   * Parses a `ResourceId` from a 32-byte Uint8Array.
   */
  static fromBytes(bytes: Uint8Array): ResourceId {
    assert(bytes.length === 32, 'bytes must be 32 bytes');

    const targetSystem = bytes.slice(0, 26);

    const chainTypeInt = new DataView(bytes.buffer).getUint16(32 - 6, BE);
    const chainType = castToChainType(chainTypeInt);
    const chainId = new DataView(bytes.buffer).getUint32(32 - 4, BE);

    return new ResourceId(targetSystem, chainType, chainId);
  }

  static newFromContractAddress(
    contractAddress: string,
    chainType: ChainType,
    chainId: number
  ): ResourceId {
    assert(
      (contractAddress.length === 42 && contractAddress.includes('0x')) ||
        (contractAddress.length === 40 && !contractAddress.includes('0x')),
      'contractAddress must be 42 bytes'
    );

    const targetSystem = new Uint8Array(26);

    // 6 -> 26
    targetSystem.set(hexToU8a(contractAddress), 6);

    return new ResourceId(targetSystem, chainType, chainId);
  }

  /**
   * Converts the resource ID into a 32-byte Uint8Array.
   */
  toU8a(): Uint8Array {
    const resourceId = new Uint8Array(32);

    resourceId.set(this.targetSystem, 0);
    const view = new DataView(resourceId.buffer);

    // 26 -> 28
    view.setUint16(26, this.chainType, BE);
    // 28 -> 32
    view.setUint32(28, this.chainId, BE);

    return resourceId;
  }

  /**
   * Converts the resource ID into a 32-byte Hex-encoded string.
   */
  toString(): string {
    return u8aToHex(this.toU8a());
  }
}
