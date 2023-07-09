// Copyright 2022-2023 Webb Technologies Inc.
// SPDX-License-Identifier: Apache-2.0

// Each ChainType has its own namespace of ChainIDs.
export enum ChainType {
  None = 0x0000,
  EVM = 0x0100,
  Substrate = 0x0200,
  SubstrateDevelopment = 0x0250,
  PolkadotRelayChain = 0x0301,
  KusamaRelayChain = 0x0302,
  PolkadotParachain = 0x0310,
  KusamaParachain = 0x0311,
  Cosmos = 0x0400,
  Solana = 0x0500,
}

export function castToChainType(v: number): ChainType {
  switch (v) {
    case 0x0100:
      return ChainType.EVM;
    case 0x0200:
      return ChainType.Substrate;
    case 0x0301:
      return ChainType.PolkadotRelayChain;
    case 0x0302:
      return ChainType.KusamaRelayChain;
    case 0x0310:
      return ChainType.PolkadotParachain;
    case 0x0311:
      return ChainType.KusamaParachain;
    case 0x0400:
      return ChainType.Cosmos;
    case 0x0500:
      return ChainType.Solana;
    default:
      return ChainType.None;
  }
}

export type TypedChainId = {
  chainType: ChainType;
  chainId: number;
};

/**
 * @param num - the number to be converted
 * @param min - the minimum bytes the array should hold (in the case of requiring empty bytes to match rust values)
 * @returns
 */
export const numToByteArray = (num: number, min: number): number[] => {
  let arr = [];

  while (num > 0) {
    arr.push(num % 256);
    num = Math.floor(num / 256);
  }

  arr.reverse();

  // maintain minimum number of bytes
  while (arr.length < min) {
    arr = [0, ...arr];
  }

  return arr;
};

export const byteArrayToNum = (arr: number[]): number => {
  let n = 0;

  for (const i of arr) {
    n = n * 256 + i;
  }

  return n;
};

export const calculateTypedChainId = (chainType: ChainType, chainId: number): number => {
  const chainTypeArray = numToByteArray(chainType, 2);
  const chainIdArray = numToByteArray(chainId, 4);
  const fullArray = [...chainTypeArray, ...chainIdArray];

  return byteArrayToNum(fullArray);
};

export const calculateTypedChainIdBytes = (typedChainId: number): string => {
  // Return big endian 8 bytes (64 bits) representation of typedChainId as a string
  const bytes = new Uint8Array(numToByteArray(typedChainId, 8));
  return Buffer.from(bytes).toString('hex');
};

export const parseTypedChainId = (chainIdType: number): TypedChainId => {
  const byteArray = numToByteArray(chainIdType, 4);
  const chainType = byteArrayToNum(byteArray.slice(0, 2));
  const chainId = byteArrayToNum(byteArray.slice(2));

  return { chainId, chainType };
};
