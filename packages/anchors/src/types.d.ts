// Copyright 2023 @webb-tools/
// File contains all the types used in the anchors package

import { IVariableAnchorExtData, IVariableAnchorPublicInputs } from '@webb-tools/interfaces';
import { Keypair } from '@webb-tools/sdk-core';
import { BigNumber, Overrides, ethers } from 'ethers';

export interface SetupTransactionResult {
  extAmount: BigNumber;
  extData: IVariableAnchorExtData;
  publicInputs: IVariableAnchorPublicInputs;
}

export interface TransactionOptions {
  keypair?: Keypair;
}

/**
 * Utility type to add the `from` property to an override type.
 */
export type OverridesWithFrom<T extends Overrides> = T & { from?: string | Promise<string> };
