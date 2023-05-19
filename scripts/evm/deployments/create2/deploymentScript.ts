import { FungibleTokenWrapper } from '@webb-tools/tokens';
import { fetchComponentsFromFilePaths, getChainIdType, vanchorFixtures } from '@webb-tools/utils';
import { DeployerConfig } from '@webb-tools/interfaces';
import path from 'path';
import { ethers } from 'ethers';
import {
  chainIdTypeGoerli,
  chainIdTypeOptimism,
  chainIdTypeArbitrum,
  chainIdTypePolygon,
  chainIdTypeMoonbase,
  walletGoerli,
  walletOptimism,
  walletArbitrum,
  walletPolygon,
  walletMoonbase,
  chainIdTypeHermes,
  chainIdTypeAthena,
  chainIdTypeDemeter,
  walletHermes,
  walletAthena,
  walletDemeter,
  chainIdTypeSepolia,
  walletSepolia,
  chainIdTypeAurora,
} from '../../ethersGovernorWallets';
import { EvmLinkedAnchor, ProposalSigningBackend } from '@webb-tools/test-utils';
import { ContractConfig, getEvmChainConfig, writeEvmChainConfig } from '../utils';
import { zip } from 'itertools';
import {
  EndPointConfig,
  goerliEndPoints,
  moonbaseEndPoints,
  optimismEndPoints,
  polygonEndPoints,
  sepoliaEndPoints,
} from '../endPoints';
import Create2VBridge from './create2Bridge';

async function deploySignatureVBridge(
  tokens: Record<number, string[]>,
  deployers: DeployerConfig
): Promise<Create2VBridge> {
  let assetRecord: Record<number, string[]> = {};
  let chainIdsArray: number[] = [];
  let existingWebbTokens = new Map<number, FungibleTokenWrapper>();
  let governorConfig: Record<number, string> = {};

  for (const chainIdType of Object.keys(deployers)) {
    assetRecord[chainIdType] = tokens[chainIdType];
    chainIdsArray.push(Number(chainIdType));
    governorConfig[Number(chainIdType)] = await deployers[chainIdType].getAddress();
    existingWebbTokens[chainIdType] = null;
    console.log(tokens[chainIdType]);
  }

  const bridgeInput = {
    vAnchorInputs: {
      asset: assetRecord,
    },
    chainIDs: chainIdsArray,
    webbTokens: existingWebbTokens,
  };

  console.log(bridgeInput);

  const zkComponentsSmall = await vanchorFixtures[28]();
  const zkComponentsLarge = await vanchorFixtures[168]();

  console.log(governorConfig);

  return Create2VBridge.deployVariableAnchorBridge(
    bridgeInput,
    deployers,
    governorConfig,
    zkComponentsSmall,
    zkComponentsLarge
  );
}

async function run() {
  const deployers: DeployerConfig = {
    // [chainIdTypeGoerli]: walletGoerli,
    [chainIdTypeSepolia]: walletSepolia,
    // [chainIdTypeOptimism]: walletOptimism,
    // [chainIdTypePolygon]: walletPolygon,
    // [chainIdTypeMoonbase]: walletMoonbase,
  };

  const tokens: Record<number, string[]> = {
    // [chainIdTypeGoerli]: ["0", ""],
    [chainIdTypeSepolia]: ['0', '0xeD43f81C17976372Fcb5786Dd214572e7dbB92c7'],
    // [chainIdTypeOptimism]: ["0", "0x4200000000000000000000000000000000000006"],
    // [chainIdTypePolygon]: ["0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"],
    // [chainIdTypeMoonbase]: ["0xD909178CC99d318e4D46e7E66a972955859670E1"],
  };

  const endPoints: Record<number, EndPointConfig> = {
    // [chainIdTypeGoerli]: goerliEndPoints,
    [chainIdTypeSepolia]: sepoliaEndPoints,
    // [chainIdTypeOptimism]: optimismEndPoints,
    // [chainIdTypePolygon]: polygonEndPoints,
    // [chainIdTypeMoonbase]: moonbaseEndPoints,
  };

  const vbridge = await deploySignatureVBridge(tokens, deployers);

  // print out all the info for the addresses
  const bridgeConfig = await vbridge.exportConfig();

  const anchorIterable = bridgeConfig.vAnchors.values();
  const bridgeSideIterable = bridgeConfig.vBridgeSides.values();

  for (const [anchor, bridgeSide] of zip(anchorIterable, bridgeSideIterable)) {
    const chainId = await anchor.signer.getChainId();
    const anchorContractConfig: ContractConfig = {
      address: anchor.contract.address.toLowerCase(),
      deployedAt: anchor.contract.deployTransaction.blockNumber ?? 1,
    };
    const bridgeContractConfig: ContractConfig = {
      address: bridgeSide.contract.address.toLowerCase(),
      deployedAt: bridgeSide.contract.deployTransaction.blockNumber ?? 1,
    };
    const proposalSigningBackend: ProposalSigningBackend = { type: 'DKGNode', node: 'tangle' };
    const linkedAnchors: EvmLinkedAnchor[] = [];
    const typedChainId = getChainIdType(chainId);
    const beneficiary = '0xf1fd5607b90f6c421db7313158baac170d4f053b'; // relayer wallet address

    // Add all other anchors to the list of linked anchors
    for (const otherAnchor of Array.from(bridgeConfig.vAnchors.values())) {
      if (otherAnchor !== anchor) {
        linkedAnchors.push({
          chainId: (await otherAnchor.contract.getChainId()).toString(),
          address: otherAnchor.contract.address.toLowerCase(),
          type: 'Evm',
        });
      }
    }

    const endPointConfig = endPoints[typedChainId];
    // construct chain configuration
    const chainConfig = getEvmChainConfig(
      chainId,
      anchorContractConfig,
      bridgeContractConfig,
      deployers[typedChainId],
      linkedAnchors,
      proposalSigningBackend,
      endPointConfig,
      beneficiary
    );

    // convert config to kebab case and write to json file
    const dirPath = `${__dirname}/relayer-config`;
    writeEvmChainConfig(`${dirPath}/${endPointConfig.name}.toml`, chainConfig);

    console.log(
      `Anchor ${anchorContractConfig.address} deployed at: ${anchorContractConfig.deployedAt} for chainId ${chainId}`
    );

    console.log(
      `BridgeSide ${bridgeContractConfig.address} deployed at: ${bridgeContractConfig.deployedAt} for chain ${chainId}`
    );
  }

  for (const webbToken of Array.from(bridgeConfig.webbTokenAddresses.entries())) {
    console.log(`webbToken entry: ${webbToken[0]} + ${webbToken[1].toLowerCase()}`);
  }
}

run();
