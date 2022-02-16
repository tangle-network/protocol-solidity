require('dotenv').config();
import { ethers } from 'ethers';
import { fetchComponentsFromFilePaths, Overrides } from '@webb-tools/utils';
import { SignatureBridge, SignatureBridgeSide } from '@webb-tools/bridges';
import { BridgeInput, DeployerConfig, GovernorConfig, IAnchor, IAnchorDeposit } from "@webb-tools/interfaces";

import path from "path";

export async function run() {

  const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
  const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
  const providerKovan = new ethers.providers.JsonRpcProvider(`https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
  const walletKovan = new ethers.Wallet(process.env.PRIVATE_KEY!, providerKovan);
  const providerPolygon = new ethers.providers.JsonRpcProvider('https://rpc-mumbai.maticvigil.com/');
  const walletPolygon = new ethers.Wallet(process.env.PRIVATE_KEY!, providerPolygon);
  const providerRopsten = new ethers.providers.JsonRpcProvider(`https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
  const walletRopsten = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRopsten);
  const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
  const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);
  const providerOptimism = new ethers.providers.JsonRpcProvider('https://kovan.optimism.io');
  const walletOptimism = new ethers.Wallet(process.env.PRIVATE_KEY!, providerOptimism);
  const providerArbitrum = new ethers.providers.JsonRpcProvider('https://rinkeby.arbitrum.io/rpc');
  const walletArbitrum = new ethers.Wallet(process.env.PRIVATE_KEY!, providerArbitrum);

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/poseidon_bridge_6.wasm'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/witness_calculator.js'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/circuit_final.zkey')
  );

  const bridgeInput: BridgeInput = {
    anchorInputs: {
      asset: {
        3: ['0xc778417E063141139Fce010982780140Aa0cD5Ab'],
        4: ['0xc778417E063141139Fce010982780140Aa0cD5Ab'],
        5: ['0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'],
        80001: ['0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889'],
        69: ['0xbC6F6b680bc61e30dB47721c6D1c5cde19C1300d'],
        421611: ['0xEBbc3452Cc911591e4F18f3b36727Df45d6bd1f9'],
      },
      anchorSizes: ['100000000000000000'],
    },
    chainIDs: [3, 4, 5, 80001, 69, 421611],
  };

  //Record<number, ethers.Signer>;
  const deployers: DeployerConfig = {
    wallets: {
      80001: walletPolygon,
      3: walletRopsten,
      4: walletRinkeby,
      5: walletGoerli,
      69: walletOptimism,
      421611: walletArbitrum,
    },
    gasLimits: {
      80001: '0x5B8D80',
      3: '0x5B8D80',
      4: '0x5B8D80',
      5: '0x5B8D80',
      69: '0x5B8D80',
      421611: '0x99999999'
    }
  };

  const governorConfig: GovernorConfig = {
    
  }

  const bridge = await SignatureBridge.deployFixedDepositBridge(bridgeInput, deployers, governorConfig, zkComponents);

  // print out all the info for the addresses to run 
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

