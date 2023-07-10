import { Transaction, utils } from 'ethers';

import { BE } from './';
import { ProposalHeader } from './ProposalHeader';
import { ResourceId } from './ResourceId';
import { hexToU8a, u8aToHex } from '@webb-tools/utils';

export interface IEVMProposal {
  readonly chainId: number;
  readonly nonce: number;
  readonly tx: Transaction;
}

export class EVMProposal implements IEVMProposal {
  readonly chainId: number;
  readonly nonce: number;
  readonly tx: Transaction;

  constructor(chainId: number, nonce: number, tx: Transaction) {
    this.chainId = chainId;
    this.nonce = nonce;
    this.tx = tx;
  }

  static fromBytes(bytes: Uint8Array): EVMProposal {
    const tx = utils.parseTransaction(bytes);
    const chainId = tx.chainId || 0;
    const nonce = tx.nonce;

    return new EVMProposal(chainId, nonce, tx);
  }

  toU8a(): Uint8Array {
    const serialized = utils.serializeTransaction(this.tx);

    return hexToU8a(serialized);
  }
}

export interface IRefreshProposal {
  readonly nonce: number;
  readonly publicKey: string;
}

export class RefreshProposal implements IRefreshProposal {
  voterMerkleRoot: string;
  sessionLength: bigint;
  voterCount: number;
  nonce: number;
  publicKey: string;

  constructor(
    voterMerkleRoot: string,
    sessionLength: bigint,
    voterCount: number,
    nonce: number,
    publicKey: string
  ) {
    this.voterMerkleRoot = voterMerkleRoot;
    this.sessionLength = sessionLength;
    this.voterCount = voterCount;
    this.nonce = nonce;
    this.publicKey = publicKey;
  }

  toU8a(): Uint8Array {
    const merkleRoot = hexToU8a(this.voterMerkleRoot, 32 * 8);
    const publicKey = hexToU8a(this.publicKey);

    const internals = new Uint8Array(8 + 4 + 4);
    const dataView = new DataView(internals.buffer);

    dataView.setBigUint64(0, this.sessionLength, BE);
    dataView.setUint32(8, this.voterCount, BE);
    dataView.setUint32(8 + 4, this.nonce, BE);

    return new Uint8Array([...merkleRoot, ...internals, ...publicKey]);
  }

  static fromBytes(bytes: Uint8Array): RefreshProposal {
    const merkleRoot = u8aToHex(bytes.slice(0, 32));
    const dataView = new DataView(bytes.buffer);
    const sessionLength = dataView.getBigUint64(32, BE);
    const voterCount = dataView.getUint32(32 + 8, BE);
    const nonce = dataView.getUint32(32 + 12, BE);
    const publicKey = bytes.slice(32 + 16, bytes.length);

    return new RefreshProposal(merkleRoot, sessionLength, voterCount, nonce, u8aToHex(publicKey));
  }
}

export interface IAnchorUpdateProposal {
  /**
   * The Anchor Proposal Header.
   */
  readonly header: ProposalHeader;
  /**
   * 32 bytes Hex-encoded string of the `merkleRoot`.
   */
  readonly merkleRoot: string;
  /**
   * 32 bytes Hex-encoded string of the `srcResourceId`.
   */
  readonly srcResourceId: ResourceId;
}

export class AnchorUpdateProposal implements IAnchorUpdateProposal {
  header: ProposalHeader;
  merkleRoot: string;
  srcResourceId: ResourceId;

  constructor(header: ProposalHeader, merkleRoot: string, srcResourceId: ResourceId) {
    this.header = header;
    this.merkleRoot = merkleRoot;
    this.srcResourceId = srcResourceId;
  }

  static fromBytes(bytes: Uint8Array): AnchorUpdateProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const merkleRoot = u8aToHex(bytes.slice(40, 72));
    const srcResourceId = ResourceId.fromBytes(bytes.slice(72, 104));

    return new AnchorUpdateProposal(header, merkleRoot, srcResourceId);
  }

  toU8a(): Uint8Array {
    const merkleRootBytesLength = 32;
    const rIdBytesLength = 32;
    const header = this.header.toU8a();
    const updateProposal = new Uint8Array(header.length + merkleRootBytesLength + rIdBytesLength);

    updateProposal.set(header, 0); // 0 -> 40

    const merkleRoot = hexToU8a(this.merkleRoot, merkleRootBytesLength * 8);

    updateProposal.set(merkleRoot, 40); // 40 -> 72
    updateProposal.set(this.srcResourceId.toU8a(), 72); // 72 -> 104

    return updateProposal;
  }
}

export interface ITokenAddProposal {
  /**
   * The Token Add Proposal Header.

   */
  readonly header: ProposalHeader;
  /**
   * 20 bytes Hex-encoded string.
   */
  readonly newTokenAddress: string;
}

export class TokenAddProposal implements ITokenAddProposal {
  header: ProposalHeader;
  newTokenAddress: string;

  constructor(header: ProposalHeader, newTokenAddress: string) {
    this.header = header;
    this.newTokenAddress = newTokenAddress;
  }

  static fromBytes(bytes: Uint8Array): TokenAddProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const newTokenAddress = u8aToHex(bytes.slice(40, 60));

    return new TokenAddProposal(header, newTokenAddress);
  }

  toU8a(): Uint8Array {
    const header = this.header.toU8a();
    const addressBytesLength = 20;
    const tokenAddProposal = new Uint8Array(header.length + 20);

    tokenAddProposal.set(header, 0); // 0 -> 40
    tokenAddProposal.set(hexToU8a(this.newTokenAddress, addressBytesLength * 8), 40); // 40 -> 60

    return tokenAddProposal;
  }
}

export interface ITokenRemoveProposal {
  /**
   * The Token Remove Proposal Header.
   */
  readonly header: ProposalHeader;
  /**
   * 20 bytes Hex-encoded string.
   */
  readonly removeTokenAddress: string;
}

export class TokenRemoveProposal implements ITokenRemoveProposal {
  header: ProposalHeader;
  removeTokenAddress: string;

  constructor(header: ProposalHeader, removeTokenAddress: string) {
    this.header = header;
    this.removeTokenAddress = removeTokenAddress;
  }

  static fromBytes(bytes: Uint8Array): TokenRemoveProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const removeTokenAddress = u8aToHex(bytes.slice(40, 60));

    return new TokenRemoveProposal(header, removeTokenAddress);
  }

  toU8a(): Uint8Array {
    const header = this.header.toU8a();
    const addressBytesLength = 20;
    const tokenRemoveProposal = new Uint8Array(header.length + addressBytesLength);

    tokenRemoveProposal.set(header, 0); // 0 -> 40
    tokenRemoveProposal.set(hexToU8a(this.removeTokenAddress, addressBytesLength * 8), 40); // 40 -> 60

    return tokenRemoveProposal;
  }
}

export interface IWrappingFeeUpdateProposal {
  /**
   * The Wrapping Fee Update Proposal Header.
   */
  readonly header: ProposalHeader;
  /**
   * 2 byte Hex-encoded string.
   */
  readonly newFee: string;
}

export class WrappingFeeUpdateProposal implements IWrappingFeeUpdateProposal {
  header: ProposalHeader;
  newFee: string;

  constructor(header: ProposalHeader, newFee: string) {
    this.header = header;
    this.newFee = newFee;
  }

  static fromBytes(bytes: Uint8Array): WrappingFeeUpdateProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const newFee = u8aToHex(bytes.slice(40, 42));

    return new WrappingFeeUpdateProposal(header, newFee);
  }

  toU8a(): Uint8Array {
    const newFeeBytesLength = 2;
    const header = this.header.toU8a();
    const wrappingFeeUpdateProposal = new Uint8Array(header.length + newFeeBytesLength);

    wrappingFeeUpdateProposal.set(header, 0); // 0 -> 40
    wrappingFeeUpdateProposal.set(hexToU8a(this.newFee, newFeeBytesLength * 8), 40); // 40 -> 42

    return wrappingFeeUpdateProposal;
  }
}

export interface IMinWithdrawalLimitProposal {
  /**
   * The Wrapping Fee Update Proposal Header.
   */
  readonly header: ProposalHeader;
  /**
   * 32 bytes Hex-encoded string.
   */
  readonly minWithdrawalLimitBytes: string;
}

export class MinWithdrawalLimitProposal implements IMinWithdrawalLimitProposal {
  header: ProposalHeader;
  minWithdrawalLimitBytes: string;

  constructor(header: ProposalHeader, minWithdrawalLimitBytes: string) {
    this.header = header;
    this.minWithdrawalLimitBytes = minWithdrawalLimitBytes;
  }

  static fromBytes(bytes: Uint8Array): MinWithdrawalLimitProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const minWithdrawalLimitBytes = u8aToHex(bytes.slice(40, 72));

    return new MinWithdrawalLimitProposal(header, minWithdrawalLimitBytes);
  }

  toU8a(): Uint8Array {
    const limitBytesLength = 32;
    const header = this.header.toU8a();
    const minWithdrawalLimitProposal = new Uint8Array(header.length + limitBytesLength);

    minWithdrawalLimitProposal.set(header, 0); // 0 -> 40
    minWithdrawalLimitProposal.set(
      hexToU8a(this.minWithdrawalLimitBytes, limitBytesLength * 8),
      40
    ); // 40 -> 72

    return minWithdrawalLimitProposal;
  }
}

export interface IMaxDepositLimitProposal {
  /**
   * The Wrapping Fee Update Proposal Header.
   */
  readonly header: ProposalHeader;
  /**
   * 32 bytes Hex-encoded string.
   */
  readonly maxDepositLimitBytes: string;
}

export class MaxDepositLimitProposal implements IMaxDepositLimitProposal {
  header: ProposalHeader;
  maxDepositLimitBytes: string;

  constructor(header: ProposalHeader, maxDepositLimitBytes: string) {
    this.header = header;
    this.maxDepositLimitBytes = maxDepositLimitBytes;
  }

  static fromBytes(bytes: Uint8Array): MaxDepositLimitProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const maxDepositLimitBytes = u8aToHex(bytes.slice(40, 72));

    return new MaxDepositLimitProposal(header, maxDepositLimitBytes);
  }

  toU8a(): Uint8Array {
    const limitBytesLength = 32;
    const header = this.header.toU8a();
    const maxDepositLimitProposal = new Uint8Array(header.length + limitBytesLength);

    maxDepositLimitProposal.set(header, 0); // 0 -> 40
    maxDepositLimitProposal.set(hexToU8a(this.maxDepositLimitBytes, limitBytesLength * 8), 40); // 40 -> 72

    return maxDepositLimitProposal;
  }
}

export interface IResourceIdUpdateProposal {
  /**
   * The ResourceIdUpdateProposal Header.
   */
  readonly header: ProposalHeader;
  /**
   * 32 bytes Hex-encoded string.
   */
  readonly newResourceId: string;
  /**
   * 20 bytes Hex-encoded string.
   */
  readonly handlerAddress: string;
}

export class ResourceIdUpdateProposal implements IResourceIdUpdateProposal {
  header: ProposalHeader;
  newResourceId: string;
  handlerAddress: string;

  constructor(header: ProposalHeader, newResourceId: string, handlerAddress: string) {
    this.header = header;
    this.newResourceId = newResourceId;
    this.handlerAddress = handlerAddress;
  }

  static fromBytes(bytes: Uint8Array): ResourceIdUpdateProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const newResourceId = u8aToHex(bytes.slice(40, 72));
    const handlerAddress = u8aToHex(bytes.slice(72, 92));

    return new ResourceIdUpdateProposal(header, newResourceId, handlerAddress);
  }

  toU8a(): Uint8Array {
    const rIdBytesLength = 32;
    const addressBytesLength = 20;
    const header = this.header.toU8a();
    const resourceIdUpdateProposal = new Uint8Array(
      header.length + rIdBytesLength + addressBytesLength
    );

    resourceIdUpdateProposal.set(header, 0); // 0 -> 40
    resourceIdUpdateProposal.set(hexToU8a(this.newResourceId, rIdBytesLength * 8), 40); // 40 -> 72
    resourceIdUpdateProposal.set(hexToU8a(this.handlerAddress, addressBytesLength * 8), 72); // 72 -> 92

    return resourceIdUpdateProposal;
  }
}

export interface ISetTreasuryHandlerProposal {
  /**
   * The Token Add Proposal Header.
   */
  readonly header: ProposalHeader;
  /**
   * 20 bytes Hex-encoded string.
   */
  readonly newTreasuryHandler: string;
}

export class SetTreasuryHandlerProposal implements ISetTreasuryHandlerProposal {
  header: ProposalHeader;
  newTreasuryHandler: string;

  constructor(header: ProposalHeader, newTreasuryHandler: string) {
    this.header = header;
    this.newTreasuryHandler = newTreasuryHandler;
  }

  static fromBytes(bytes: Uint8Array): SetTreasuryHandlerProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const newTreasuryHandler = u8aToHex(bytes.slice(40, 60));

    return new SetTreasuryHandlerProposal(header, newTreasuryHandler);
  }

  toU8a(): Uint8Array {
    const addressBytesLength = 20;
    const header = this.header.toU8a();
    const setTreasuryHandlerProposal = new Uint8Array(header.length + addressBytesLength);

    setTreasuryHandlerProposal.set(header, 0); // 0 -> 40
    setTreasuryHandlerProposal.set(hexToU8a(this.newTreasuryHandler, addressBytesLength * 8), 40); // 40 -> 60

    return setTreasuryHandlerProposal;
  }
}

export interface ISetVerifierProposal {
  /**
   * The Token Add Proposal Header.
   */
  readonly header: ProposalHeader;
  /**
   * 20 bytes Hex-encoded string.
   */
  readonly newVerifier: string;
}

export class SetVerifierProposal implements ISetVerifierProposal {
  header: ProposalHeader;
  newVerifier: string;

  constructor(header: ProposalHeader, newVerifier: string) {
    this.header = header;
    this.newVerifier = newVerifier;
  }

  static fromBytes(bytes: Uint8Array): SetVerifierProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const newVerifier = u8aToHex(bytes.slice(40, 60));

    return new SetVerifierProposal(header, newVerifier);
  }

  toU8a(): Uint8Array {
    const addressBytesLength = 20;
    const header = this.header.toU8a();
    const setVerifierProposal = new Uint8Array(header.length + addressBytesLength);

    setVerifierProposal.set(header, 0); // 0 -> 40
    setVerifierProposal.set(hexToU8a(this.newVerifier, addressBytesLength * 8), 40); // 40 -> 60

    return setVerifierProposal;
  }
}

export interface IFeeRecipientUpdateProposal {
  /**
   * The Token Add Proposal Header.
   */
  readonly header: ProposalHeader;
  /**
   * 20 bytes Hex-encoded string.
   */
  readonly newFeeRecipient: string;
}

export class FeeRecipientUpdateProposal implements IFeeRecipientUpdateProposal {
  header: ProposalHeader;
  newFeeRecipient: string;

  constructor(header: ProposalHeader, newFeeRecipient: string) {
    this.header = header;
    this.newFeeRecipient = newFeeRecipient;
  }

  static fromBytes(bytes: Uint8Array): FeeRecipientUpdateProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const newFeeRecipient = u8aToHex(bytes.slice(40, 60));

    return new FeeRecipientUpdateProposal(header, newFeeRecipient);
  }

  toU8a(): Uint8Array {
    const addressBytesLength = 20;
    const header = this.header.toU8a();
    const feeRecipientUpdateProposal = new Uint8Array(header.length + addressBytesLength);

    feeRecipientUpdateProposal.set(header, 0); // 0 -> 40
    feeRecipientUpdateProposal.set(hexToU8a(this.newFeeRecipient, addressBytesLength * 8), 40); // 40 -> 60

    return feeRecipientUpdateProposal;
  }
}

export interface IRescueTokensProposal {
  /**
   * The Rescue Token Proposals Header.
   */
  readonly header: ProposalHeader;

  /**
   * 20 bytes Hex-encoded string.
   */
  readonly tokenAddress: string;
  /**
   * 20 bytes Hex-encoded string.
   */
  readonly toAddress: string;
  /**
   * 32 bytes Hex-encoded string.
   */
  readonly amount: string;
}

export class RescueTokensProposal implements IRescueTokensProposal {
  header: ProposalHeader;
  tokenAddress: string;
  toAddress: string;
  amount: string;

  constructor(header: ProposalHeader, tokenAddress: string, toAddress: string, amount: string) {
    this.header = header;
    this.tokenAddress = tokenAddress;
    this.toAddress = toAddress;
    this.amount = amount;
  }

  static fromBytes(bytes: Uint8Array): RescueTokensProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const tokenAddress = u8aToHex(bytes.slice(40, 60));
    const toAddress = u8aToHex(bytes.slice(60, 80));
    const amount = u8aToHex(bytes.slice(80, 112));

    return new RescueTokensProposal(header, tokenAddress, toAddress, amount);
  }

  toU8a(): Uint8Array {
    const addressBytesLength = 20;
    const amountBytesLength = 32;
    const header = this.header.toU8a();
    const rescueTokensProposal = new Uint8Array(
      header.length + addressBytesLength + addressBytesLength + amountBytesLength
    );

    rescueTokensProposal.set(header, 0); // 0 -> 40
    rescueTokensProposal.set(hexToU8a(this.tokenAddress, addressBytesLength * 8), 40); // 40 -> 60
    rescueTokensProposal.set(hexToU8a(this.toAddress, addressBytesLength * 8), 60); // 60 -> 80
    rescueTokensProposal.set(hexToU8a(this.amount, amountBytesLength * 8), 80); // 80 -> 112

    return rescueTokensProposal;
  }
}

export interface IRegisterFungibleTokenProposal {
  /**
   * The Rescue Token Proposals Header.
   */
  readonly header: ProposalHeader;

  /**
   * 20 bytes Hex-encoded string.
   */
  readonly tokenHandler: string;
  /**
   * 4 bytes Hex-encoded string.
   */
  readonly assetId: string;
  /**
   * 32 bytes Hex-encoded string.
   */
  readonly name: string;
  /**
   * 32 bytes Hex-encoded string.
   */
  readonly symbol: string;
}

export class RegisterFungibleTokenProposal implements IRegisterFungibleTokenProposal {
  header: ProposalHeader;
  tokenHandler: string;
  assetId: string;
  name: string;
  symbol: string;

  constructor(
    header: ProposalHeader,
    tokenHandler: string,
    assetId: string,
    name: string,
    symbol: string
  ) {
    this.header = header;
    this.tokenHandler = tokenHandler;
    this.assetId = assetId;
    this.name = name;
    this.symbol = symbol;
  }

  static fromBytes(bytes: Uint8Array): RegisterFungibleTokenProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const tokenHandler = u8aToHex(bytes.slice(40, 60));
    const assetId = u8aToHex(bytes.slice(60, 64));
    const name = u8aToHex(bytes.slice(64, 96));
    const symbol = u8aToHex(bytes.slice(96, 128));

    return new RegisterFungibleTokenProposal(header, tokenHandler, assetId, name, symbol);
  }

  toU8a(): Uint8Array {
    const header = this.header.toU8a();
    const tokenHandlerBytesLength = 20;
    const assetIdBytesLength = 4;
    const nameBytesLength = 32;
    const symbolBytesLength = 32;
    const registerFungibleTokenProposal = new Uint8Array(
      header.length +
        tokenHandlerBytesLength +
        assetIdBytesLength +
        nameBytesLength +
        symbolBytesLength
    );

    registerFungibleTokenProposal.set(header, 0); // 0 -> 40
    registerFungibleTokenProposal.set(hexToU8a(this.tokenHandler, tokenHandlerBytesLength * 8), 40); // 40 -> 60
    registerFungibleTokenProposal.set(hexToU8a(this.assetId, assetIdBytesLength * 8), 60); // 60 -> 64
    registerFungibleTokenProposal.set(hexToU8a(this.name, nameBytesLength * 8), 64); // 64 -> 96
    registerFungibleTokenProposal.set(hexToU8a(this.symbol, symbolBytesLength * 8), 96); // 96 -> 128

    return registerFungibleTokenProposal;
  }
}

export interface IRegisterNftTokenProposal {
  /**
   * The Rescue Token Proposals Header.
   */
  readonly header: ProposalHeader;

  /**
   * 20 bytes Hex-encoded string.
   */
  readonly tokenHandler: string;
  /**
   * 4 bytes Hex-encoded string.
   */
  readonly assetId: string;
  /**
   * 20 bytes Hex-encoded string.
   */
  readonly collectionAddress: string;
  /**
   * 32 bytes Hex-encoded string.
   */
  readonly salt: string;
  /**
   * 64 bytes Hex-encoded string.
   */
  readonly uri: string;
}

export class RegisterNftTokenProposal implements IRegisterNftTokenProposal {
  header: ProposalHeader;
  tokenHandler: string;
  assetId: string;
  collectionAddress: string;
  salt: string;
  uri: string;

  constructor(
    header: ProposalHeader,
    tokenHandler: string,
    assetId: string,
    collectionAddress: string,
    salt: string,
    uri: string
  ) {
    this.header = header;
    this.tokenHandler = tokenHandler;
    this.assetId = assetId;
    this.collectionAddress = collectionAddress;
    this.salt = salt;
    this.uri = uri;
  }

  static fromBytes(bytes: Uint8Array): RegisterNftTokenProposal {
    const header = ProposalHeader.fromBytes(bytes.slice(0, 40));
    const tokenHandler = u8aToHex(bytes.slice(40, 60));
    const assetId = u8aToHex(bytes.slice(60, 64));
    const collectionAddress = u8aToHex(bytes.slice(64, 84));
    const salt = u8aToHex(bytes.slice(84, 116));
    const uri = u8aToHex(bytes.slice(116, 180));

    return new RegisterNftTokenProposal(
      header,
      tokenHandler,
      assetId,
      collectionAddress,
      salt,
      uri
    );
  }

  toU8a(): Uint8Array {
    const header = this.header.toU8a();
    const tokenHandlerBytesLength = 20;
    const assetIdBytesLength = 4;
    const collectionAddressBytesLength = 20;
    const saltBytesLength = 32;
    const uriBytesLength = 64;
    const registerNftTokenProposal = new Uint8Array(
      header.length +
        tokenHandlerBytesLength +
        assetIdBytesLength +
        collectionAddressBytesLength +
        saltBytesLength +
        uriBytesLength
    );

    registerNftTokenProposal.set(header, 0); // 0 -> 40
    registerNftTokenProposal.set(hexToU8a(this.tokenHandler, tokenHandlerBytesLength * 8), 40); // 40 -> 60
    registerNftTokenProposal.set(hexToU8a(this.assetId, assetIdBytesLength * 8), 60); // 60 -> 64
    registerNftTokenProposal.set(
      hexToU8a(this.collectionAddress, collectionAddressBytesLength * 8),
      64
    ); // 64 -> 84
    registerNftTokenProposal.set(hexToU8a(this.salt, saltBytesLength * 8), 84); // 84 -> 116
    registerNftTokenProposal.set(hexToU8a(this.uri, uriBytesLength * 8), 116); // 116 -> 180

    return registerNftTokenProposal;
  }
}
