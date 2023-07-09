import { BigNumber } from 'ethers';

export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const FIELD_SIZE = BigNumber.from(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

export * from '../utils';
export * from './merkle-tree';
export * from './note';
export * from './utxo';
export * from './typed-chain-id';
export * from './keypair';
