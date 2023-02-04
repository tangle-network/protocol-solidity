import { IVariableAnchorExtData, IVariableAnchorPublicInputs } from '@webb-tools/interfaces';
import { Keypair } from '@webb-tools/sdk-core';
import { BigNumber } from 'ethers';

export { AnchorHandler } from './AnchorHandler';
export { VAnchor } from './VAnchor';
export { VAnchorForest } from './VAnchorForest';
export { ChainalysisVAnchor } from './ChainalysisVAnchor';
export { IdentityVAnchor } from './IdentityVAnchor';
export { OpenVAnchor } from './OpenVAnchor';
export { PoseidonHasher } from './PoseidonHasher';
export { Deployer } from '@webb-tools/create2-utils';
export { BatchTreeUpdater } from './BatchTreeUpdater';
export { MultiAssetVAnchor } from './MultiAssetVAnchor';

export interface TransactionOptions {
  relaying?: boolean;
  gasLimit?: string | number;
  gasPrice?: string | number;
  keypair?: Keypair;
}

export interface SetupTransactionResult {
  extAmount: BigNumber;
  extData: IVariableAnchorExtData;
  publicInputs: IVariableAnchorPublicInputs;
}
