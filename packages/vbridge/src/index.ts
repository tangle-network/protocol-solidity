export { VAnchor } from './VAnchor';
export { VBridge, BridgeConfig, VBridgeInput, DeployerConfig, ExistingAssetInput} from './VBridge';
export { VBridgeSide } from './VBridgeSide';
export { MerkleTree } from './MerkleTree';
export { Verifier } from './Verifier';
export { Utxo } from './utxo';
export {poseidonHash2, poseidonHash} from './utils';

import { BigNumberish } from 'ethers';
export interface RootInfo {
  merkleRoot: BigNumberish;
  chainId: BigNumberish;
}
