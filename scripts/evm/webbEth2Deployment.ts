require('dotenv').config();
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';
import { SignatureBridge } from '@webb-tools/bridges';
import { BridgeInput, DeployerConfig, GovernorConfig } from "@webb-tools/interfaces";
import { 
  chainIdTypeArbitrum,
  chainIdTypeOptimism,
  walletArbitrum,
  walletOptimism,
} from './ethersGovernorWallets';

import path from "path";

export async function run() {

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/poseidon_anchor_2.wasm'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/witness_calculator.js'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey')
  );

  const bridgeInput: BridgeInput = {
    anchorInputs: {
      asset: {
        [chainIdTypeOptimism]: ['0xbC6F6b680bc61e30dB47721c6D1c5cde19C1300d'],
        [chainIdTypeArbitrum]: ['0xEBbc3452Cc911591e4F18f3b36727Df45d6bd1f9'],
      },
      anchorSizes: ['100000000'],
    },
    chainIDs: [chainIdTypeOptimism, chainIdTypeArbitrum],
  };

  //Record<number, ethers.Signer>;
  const deployers: DeployerConfig = {
    wallets: {
      [chainIdTypeOptimism]: walletOptimism,
      [chainIdTypeArbitrum]: walletArbitrum,
    },
    gasLimits: {
      [chainIdTypeOptimism]: '0x5B8D80',
      [chainIdTypeArbitrum]: '0x99999999'
    }
  };

  const governorConfig: GovernorConfig = {
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

