require('dotenv').config();
import { ethers } from 'ethers';
import { fetchComponentsFromFilePaths, getChainIdType, Overrides } from '@webb-tools/utils';
import { SignatureBridge, SignatureBridgeSide } from '@webb-tools/bridges';
import { BridgeInput, DeployerConfig, GovernorConfig, IAnchor, IAnchorDeposit } from "@webb-tools/interfaces";
import { 
  chainIdTypeArbitrum,
  chainIdTypeGoerli,
  chainIdTypeOptimism,
  chainIdTypePolygon,
  chainIdTypeRopsten,
  chainIdTypeRinkeby,
  walletArbitrum,
  walletGoerli,
  walletOptimism,
  walletPolygon,
  walletRinkeby,
  walletRopsten
} from './ethersGovernorWallets';

import path from "path";

export async function run() {

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/6/poseidon_anchor_6.wasm'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/6/witness_calculator.js'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/6/circuit_final.zkey')
  );

  const bridgeInput: BridgeInput = {
    anchorInputs: {
      asset: {
        [chainIdTypeRopsten]: ['0xc778417E063141139Fce010982780140Aa0cD5Ab'],
        [chainIdTypeRinkeby]: ['0xc778417E063141139Fce010982780140Aa0cD5Ab'],
        [chainIdTypeGoerli]: ['0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'],
        [chainIdTypePolygon]: ['0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889'],
        [chainIdTypeOptimism]: ['0xbC6F6b680bc61e30dB47721c6D1c5cde19C1300d'],
        [chainIdTypeArbitrum]: ['0xEBbc3452Cc911591e4F18f3b36727Df45d6bd1f9'],
      },
      anchorSizes: ['100000000'],
    },
    chainIDs: [chainIdTypeRopsten, chainIdTypeRinkeby, chainIdTypeGoerli, chainIdTypePolygon, chainIdTypeOptimism, chainIdTypeArbitrum],
  };

  //Record<number, ethers.Signer>;
  const deployers: DeployerConfig = {
    wallets: {
      [chainIdTypePolygon]: walletPolygon,
      [chainIdTypeRopsten]: walletRopsten,
      [chainIdTypeRinkeby]: walletRinkeby,
      [chainIdTypeGoerli]: walletGoerli,
      [chainIdTypeOptimism]: walletOptimism,
      [chainIdTypeArbitrum]: walletArbitrum,
    },
    gasLimits: {
      [chainIdTypePolygon]: '0x5B8D80',
      [chainIdTypeRopsten]: '0x5B8D80',
      [chainIdTypeRinkeby]: '0x5B8D80',
      [chainIdTypeGoerli]: '0x5B8D80',
      [chainIdTypeOptimism]: '0x5B8D80',
      [chainIdTypeArbitrum]: '0x99999999'
    }
  };

  const governorConfig: GovernorConfig = {
    [chainIdTypePolygon]: walletPolygon,
    [chainIdTypeRopsten]: walletRopsten,
    [chainIdTypeRinkeby]: walletRinkeby,
    [chainIdTypeGoerli]: walletGoerli,
    [chainIdTypeOptimism]: walletOptimism,
    [chainIdTypeArbitrum]: walletArbitrum,
  }

  const bridge = await SignatureBridge.deployFixedDepositBridge(bridgeInput, deployers, governorConfig, zkComponents);

  // print out all the info for the addresses
  const bridgeConfig = await bridge.exportConfig();

  for (const anchor of Array.from(bridgeConfig.anchors.values())) {
    const chainId = await anchor.signer.getChainId();
    console.log(`Anchor ${anchor.contract.address.toLowerCase()} for chain ${chainId}`);
  };

  for (const bridgeSide of Array.from(bridgeConfig.bridgeSides.values())) {
    const chainId = await bridgeSide.admin.getChainId();
    console.log(`BridgeSide ${bridgeSide.contract.address.toLowerCase()} for chain ${chainId}`);
  }

  for (const webbToken of Array.from(bridgeConfig.webbTokenAddresses.entries())) {
    console.log(`webbToken entry: ${webbToken[0]} + ${webbToken[1].toLowerCase()}`);
  }
}

run();

