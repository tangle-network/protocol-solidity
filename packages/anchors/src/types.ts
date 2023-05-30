// Copyright 2023 @webb-tools/
// File contains all the types used in the anchors package

import { IVariableAnchorExtData, IVariableAnchorPublicInputs } from '@webb-tools/interfaces';
import { Keypair } from '@webb-tools/sdk-core';
import { BigNumber, Overrides } from 'ethers';

export interface SetupTransactionResult {
  extAmount: BigNumber;
  extData: IVariableAnchorExtData;
  publicInputs: IVariableAnchorPublicInputs;
}

export enum TransactionState {
  GENERATE_ZK_PROOF = 'GENERATE_ZK_PROOF',
  INITIALIZE_TRANSACTION = 'INITIALIZE_TRANSACTION',
  WAITING_FOR_FINALIZATION = 'WAITING_FOR_FINALIZATION',
  FINALIZED = 'FINALIZED',
}

export interface TransactionStateUpdatePayload {
  [TransactionState.GENERATE_ZK_PROOF]: undefined;
  [TransactionState.INITIALIZE_TRANSACTION]: undefined;
  [TransactionState.WAITING_FOR_FINALIZATION]: string;
  [TransactionState.FINALIZED]: string;
}

/**
 * Options to be passed to the `setup` function.
 * Make sure update the `splitTransactionOptions` function if you add a new property here.
 */
export interface TransactionOptions {
  keypair?: Keypair; // for identityVAnchor
  treeChainId?: string; // for vanchorForest/IdentityVAnchor
  externalLeaves?: Uint8Array[]; // for vanchorForest

  /**
   * The callback to update the transaction state
   * when the transanction progress and send
   */
  onTransactionState?: <T extends TransactionState>(
    state: T,
    payload: TransactionStateUpdatePayload[T]
  ) => void;
}

/**
 * Utility type to add the `from` property to an override type.
 */
export type OverridesWithFrom<T extends Overrides> = T & { from?: string | Promise<string> };
