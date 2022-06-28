import { ethers } from 'ethers';
import { IAnchor } from '..';
import { IBridgeSide } from '../IBridgeSide';

// Deployer config matches the chainId to the signer for that chain
export type DeployerConfig = {
  wallets: Record<number, ethers.Signer>;
  gasLimits?: Record<number, ethers.BigNumberish>;
}

// Initial Governor config the chainId to the initial governor for that chain
export type GovernorConfig = Record<number, ethers.Wallet>;

export type AnchorIdentifier = {
  anchorSize?: ethers.BigNumberish;
  chainId: number;
};

export type ExistingAssetInput = {
  // A record of chainId => address
  asset: Record<number, string[]>;
  anchorSizes: ethers.BigNumberish[];
}

export type Proposal = {
  data: string,
  dataHash: string,
  resourceId: string,
  chainId: number,
  leafIndex: number,
}

// Users define an input for a completely new bridge
export type BridgeInput = {
  // The tokens and anchors which should be supported after deploying from this bridge input
  anchorInputs: ExistingAssetInput,

  // The IDs of the chains to deploy to
  chainIDs: number[],
};

export type BridgeConfig = {
  // The addresses of tokens available to be transferred over this bridge config
  // chainId => GovernedTokenWrapperAddress
  webbTokenAddresses: Map<number, string>;

  // The addresses of the anchors for the GovernedTokenWrapper
  // {anchorIdentifier} => anchorAddress
  anchors: Map<string, IAnchor>,

  // The addresses of the Bridge contracts (bridgeSides) to interact with
  bridgeSides: Map<number, IBridgeSide>,
}
