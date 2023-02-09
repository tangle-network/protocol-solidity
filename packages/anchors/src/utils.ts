// Copyright 2023 @webb-tools/
// File contains all the utility functions used in the anchors package

import { TransactionOptions } from './types';

export const zeroAddress = '0x0000000000000000000000000000000000000000';

/**
 * Checks if the given address is a native address
 * @param tokenAddress the address of the token to check
 * @returns true if the token is a native token
 */
export function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}

export function splitTransactionOptions<T extends Object>(
  options?: T & TransactionOptions
): [T, TransactionOptions] {
  const { keypair, treeChainId, ...rest } = options ?? {};

  return [rest, { keypair, treeChainId}] as [T, TransactionOptions];
}
