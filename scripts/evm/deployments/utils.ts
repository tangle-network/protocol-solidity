import fs from 'fs';
import {
  Contract,
  ConvertToKebabCase,
  EventsWatcher,
  FullChainInfo,
  LinkedAnchor,
  ProposalSigningBackend,
  WithdrawConfig,
} from '@webb-tools/test-utils';
import { EndPointConfig } from './endPoints';
import { Wallet } from 'ethers';
import { toToml } from 'tomlify-j0.4';

// Default WithdrawlConfig for the contracts.
const defaultWithdrawConfigValue: WithdrawConfig = {
  withdrawGaslimit: '0x5B8D80',
  withdrawFeePercentage: 0,
};

// Default Event watcher config.
const defaultEventWatcherConfigValue: EventsWatcher = {
  enabled: true,
  pollingInterval: 1000,
  printProgressInterval: 7000,
};

export type ContractConfig = {
  address: string;
  deployedAt: number;
};

export function getEvmChainConfig(
  chainId: number,
  anchor: ContractConfig,
  bridge: ContractConfig,
  deployerWallet: Wallet,
  linkedAnchors: LinkedAnchor[],
  proposalSigningBackend: ProposalSigningBackend,
  endpoint: EndPointConfig,
  beneficiary?: string
): FullChainInfo {
  const contracts: Contract[] = [
    // first the local Anchor
    {
      contract: 'VAnchor',
      address: anchor.address,
      deployedAt: anchor.deployedAt,
      size: 1, // Ethers
      proposalSigningBackend: proposalSigningBackend,
      withdrawConfig: defaultWithdrawConfigValue,
      eventsWatcher: defaultEventWatcherConfigValue,
      linkedAnchors: linkedAnchors,
    },
    {
      contract: 'SignatureBridge',
      address: bridge.address,
      deployedAt: bridge.deployedAt,
      eventsWatcher: defaultEventWatcherConfigValue,
    },
  ];
  const chainInfo: FullChainInfo = {
    name: endpoint.name,
    enabled: true,
    httpEndpoint: endpoint.httpEndpoint,
    wsEndpoint: endpoint.wsEndpoint,
    blockConfirmations: 0,
    chainId: chainId,
    beneficiary: beneficiary ?? '',
    privateKey: deployerWallet.privateKey,
    contracts: contracts,
  };
  return chainInfo;
}

export function writeEvmChainConfig(path: string, config: FullChainInfo) {
  type ConvertedLinkedAnchor = ConvertToKebabCase<LinkedAnchor>;
  type ConvertedContract = Omit<
    ConvertToKebabCase<Contract>,
    | 'events-watcher'
    | 'proposal-signing-backend'
    | 'withdraw-config'
    | 'linked-anchors'
    | 'deployed-at'
  > & {
    'events-watcher': ConvertToKebabCase<EventsWatcher>;
    'proposal-signing-backend'?: ConvertToKebabCase<ProposalSigningBackend>;
    'withdraw-config'?: ConvertToKebabCase<WithdrawConfig>;
    'linked-anchors'?: ConvertedLinkedAnchor[];
  };
  type ConvertedConfig = Omit<ConvertToKebabCase<typeof config>, 'contracts'> & {
    contracts: ConvertedContract[];
  };
  type FullConfigFile = {
    evm: {
      // chainId as the chain identifier
      [key: number]: ConvertedConfig;
    };
  };

  const convertedConfig: ConvertedConfig = {
    beneficiary: config.beneficiary,
    'block-confirmations': config.blockConfirmations,
    'chain-id': config.chainId,
    contracts: config.contracts.map((contract) => ({
      address: contract.address,
      contract: contract.contract,
      'deployed-at': contract.deployedAt,
      'events-watcher': {
        enabled: contract.eventsWatcher.enabled,
        'polling-interval': contract.eventsWatcher.pollingInterval,
        'print-progress-interval': contract.eventsWatcher.printProgressInterval,
      },
      'linked-anchors': contract?.linkedAnchors?.map((anchor: LinkedAnchor) =>
        anchor.type === 'Evm'
          ? {
              address: anchor.address,
              'chain-id': anchor.chainId,
              type: 'Evm',
            }
          : anchor.type === 'Substrate'
          ? {
              'chain-id': anchor.chainId,
              pallet: anchor.pallet,
              'tree-id': anchor.treeId,
              type: 'Substrate',
            }
          : {
              'resource-id': anchor.resourceId,
              type: 'Raw',
            }
      ),
      'proposal-signing-backend':
        contract.proposalSigningBackend?.type === 'Mocked'
          ? {
              'private-key': contract.proposalSigningBackend?.privateKey,
              type: 'Mocked',
            }
          : contract.proposalSigningBackend?.type === 'DKGNode'
          ? {
              node: contract.proposalSigningBackend?.node,
              type: 'DKGNode',
            }
          : undefined,
      'withdraw-config': contract.withdrawConfig
        ? {
            'withdraw-fee-percentage': contract.withdrawConfig?.withdrawFeePercentage,
            'withdraw-gaslimit': contract.withdrawConfig?.withdrawGaslimit,
          }
        : undefined,
    })),
    enabled: config.enabled,
    'http-endpoint': config.httpEndpoint,
    name: config.name,
    'private-key': config.privateKey,
    'ws-endpoint': config.wsEndpoint,
  };
  const fullConfigFile: FullConfigFile = {
    evm: {
      [config.name]: convertedConfig,
    },
  };

  const toml = toToml(fullConfigFile, { spaces: 4 });

  // Write the TOML string to a file
  fs.writeFileSync(path, toml);
}
