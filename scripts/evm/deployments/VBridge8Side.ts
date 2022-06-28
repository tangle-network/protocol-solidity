import { VBridge } from '@webb-tools/vbridge';
import { ERC20, GovernedTokenWrapper } from '@webb-tools/tokens';
import { fetchComponentsFromFilePaths, getChainIdType } from '@webb-tools/utils';
import { DeployerConfig } from '@webb-tools/interfaces';
import path from 'path';
import { ethers } from 'ethers';
import {
  chainIdTypeRinkeby,
  chainIdTypeGoerli,
  chainIdTypeKovan,
  chainIdTypeRopsten,
  chainIdTypeOptimism,
  chainIdTypeArbitrum,
  chainIdTypePolygon,
  chainIdTypeMoonbase,
  chainIdTypeHermes,
  chainIdTypeAthena,
  chainIdTypeDemeter,
  walletRinkeby,
  walletGoerli,
  walletKovan,
  walletRopsten,
  walletOptimism,
  walletArbitrum,
  walletPolygon,
  walletMoonbase,
  walletHermes,
  walletAthena,
  walletDemeter
} from '../ethersGovernorWallets';

async function deploySignatureVBridge(
  tokens: Record<number, string[]>,
  deployers: DeployerConfig
): Promise<VBridge> {
  let assetRecord: Record<number, string[]> = {};
  let chainIdsArray: number[] = [];
  let existingWebbTokens = new Map<number, GovernedTokenWrapper>();
  let governorConfig: Record<number, ethers.Wallet> = {};

  for (const chainIdType of Object.keys(deployers.wallets)) {
    assetRecord[chainIdType] = tokens[chainIdType];
    chainIdsArray.push(Number(chainIdType));
    governorConfig[Number(chainIdType)] = deployers.wallets[chainIdType];
    existingWebbTokens[chainIdType] = null;
    console.log(tokens[chainIdType]);
  }

  const bridgeInput = {
    vAnchorInputs: {
      asset: assetRecord,
    },
    chainIDs: chainIdsArray,
    webbTokens: existingWebbTokens
  }

  console.log(bridgeInput);

  const zkComponentsSmall = await fetchComponentsFromFilePaths(
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_2/8/poseidon_vanchor_2_8.wasm`
    ),
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_2/8/witness_calculator.js`
    ),
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_2/8/circuit_final.zkey`
    )
  );
  const zkComponentsLarge = await fetchComponentsFromFilePaths(
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_16/8/poseidon_vanchor_16_8.wasm`
    ),
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_16/8/witness_calculator.js`
    ),
    path.resolve(
      __dirname,
      `../../../protocol-solidity-fixtures/fixtures/vanchor_16/8/circuit_final.zkey`
    )
  );

  console.log(governorConfig);

  return VBridge.deployVariableAnchorBridge(
    bridgeInput,
    deployers,
    governorConfig,
    zkComponentsSmall,
    zkComponentsLarge,
  )
}

async function run() {
  const deployers: DeployerConfig = {
    wallets: {
      // [chainIdTypeRinkeby]: walletRinkeby,
      // [chainIdTypeGoerli]: walletGoerli,
      // [chainIdTypeRopsten]: walletRopsten,
      // [chainIdTypeKovan]: walletKovan,
      // [chainIdTypeOptimism]: walletOptimism,
      // [chainIdTypePolygon]: walletPolygon,
      // [chainIdTypeMoonbase]: walletMoonbase,
      [chainIdTypeArbitrum]: walletArbitrum
    },
    gasLimits: {
      // [chainIdTypeRinkeby]: '0x5B8D80',
      // [chainIdTypeGoerli]: '0x5B8D80',
      // [chainIdTypeRopsten]: '0x5B8D80',
      // [chainIdTypeKovan]: '0x5B8D80',
      // [chainIdTypeOptimism]: '0x5B8D80',
      // [chainIdTypePolygon]: '0x5B8D80',
      // [chainIdTypeMoonbase]: '0x99999999999999999',
      [chainIdTypeArbitrum]: '0x99999999'
    }
  };

  const tokens: Record<number, string[]> = {
    // [chainIdTypeRinkeby]: ['0', '0xc778417E063141139Fce010982780140Aa0cD5Ab'],
    // [chainIdTypeGoerli]: ['0', '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'],
    // [chainIdTypeRopsten]: ['0', '0xc778417E063141139Fce010982780140Aa0cD5Ab'],
    // [chainIdTypeKovan]: ['0', '0xd0A1E359811322d97991E03f863a0C30C2cF029C'],
    // [chainIdTypeOptimism]: ['0', '0xbC6F6b680bc61e30dB47721c6D1c5cde19C1300d'],
    // [chainIdTypePolygon]: ['0', '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889'],
    // [chainIdTypeMoonbase]: ['0xD909178CC99d318e4D46e7E66a972955859670E1'],
    [chainIdTypeArbitrum]: ['0', '0xEBbc3452Cc911591e4F18f3b36727Df45d6bd1f9']
  }

  // const localDeployers: DeployerConfig = {
  //   wallets: {
  //     [chainIdTypeHermes]: walletHermes,
  //     [chainIdTypeAthena]: walletAthena,
  //     [chainIdTypeDemeter]: walletDemeter,
  //   },
  // };

  // const localTokens: Record<number, string[]> = {
  //   [chainIdTypeHermes]: ['0', '0xF2E246BB76DF876Cef8b38ae84130F4F55De395b'],
  //   [chainIdTypeAthena]: ['0', '0xF2E246BB76DF876Cef8b38ae84130F4F55De395b'],
  //   [chainIdTypeDemeter]: ['0', '0xF2E246BB76DF876Cef8b38ae84130F4F55De395b'],
  // }

  const vbridge = await deploySignatureVBridge(
    tokens,
    deployers
  );

  // print out all the info for the addresses
  const bridgeConfig = await vbridge.exportConfig();

  for (const anchor of Array.from(bridgeConfig.vAnchors.values())) {
    const chainId = await anchor.signer.getChainId();
    console.log(`Anchor ${anchor.contract.address.toLowerCase()} for chain ${chainId}`);
  };

  for (const bridgeSide of Array.from(bridgeConfig.vBridgeSides.values())) {
    const chainId = await bridgeSide.admin.getChainId();
    console.log(`BridgeSide ${bridgeSide.contract.address.toLowerCase()} for chain ${chainId}`);
  }

  for (const webbToken of Array.from(bridgeConfig.webbTokenAddresses.entries())) {
    console.log(`webbToken entry: ${webbToken[0]} + ${webbToken[1].toLowerCase()}`);
  }
}

run();
