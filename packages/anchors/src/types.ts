// Copyright 2023 @webb-tools/
// File contains all the types used in the anchors package

import { IVariableAnchorExtData, IVariableAnchorPublicInputs } from '@webb-tools/interfaces';
import { Keypair } from '@webb-tools/sdk-core';
import { BigNumberish, Overrides, ethers } from 'ethers';

export interface SetupTransactionResult {
  extAmount: BigNumberish;
  extData: IVariableAnchorExtData;
  publicInputs: IVariableAnchorPublicInputs;
}

/**
 * Options to be passed to the `setup` function.
 * Make sure update the `splitTransactionOptions` function if you add a new property here.
 */
export interface TransactionOptions {
  keypair?: Keypair; // for identityVAnchor
  treeChainId?: string; // for vanchorForest/IdentityVAnchor
  externalLeaves?: BigNumberish[]; // for vanchorForest
}

/**
 * Utility type to add the `from` property to an override type.
 */
export type OverridesWithFrom<T extends Overrides> = T & { from?: string | Promise<string> };
