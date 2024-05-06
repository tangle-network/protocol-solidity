import { ethers, BaseContract } from 'ethers';
import { IVAnchor } from '..';
import { IBridgeSide } from '../IBridgeSide';

// Deployer config matches the chainId to the signer for that chain
export type DeployerConfig = Record<number, ethers.Wallet>;

// Initial Governor config the chainId to the initial governor for that chain
export type GovernorWithJobId = {
  address: string;
  jobId: number;
};

/**
 * The governor config is a record of chainId => governor eth address
 * or chainId => {governor: eth address, jobId: number}, where the JobId is the
 * JobId of the governor at the time of deployment. JobId is zero if not specified.
 **/
export type GovernorConfig = Record<number, string | GovernorWithJobId>;

export type Proposal = {
  data: string;
  dataHash: string;
  resourceId: string;
  chainId: number;
  leafIndex: number;
};

export type BridgeConfig<A extends BaseContract> = {
  // The addresses of tokens available to be transferred over this bridge config
  // chainId => FungibleTokenWrapperAddress
  webbTokenAddresses: Map<number, string>;

  // The addresses of the anchors for the FungibleTokenWrapper
  // {anchorIdentifier} => anchorAddress
  anchors: Map<string, IVAnchor<A>>;

  // The addresses of the Bridge contracts (bridgeSides) to interact with
  bridgeSides: Map<number, IBridgeSide>;
};
