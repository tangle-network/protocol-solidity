require('dotenv').config();
import { ethers } from 'ethers';
import path from 'path';
import { SignatureBridge } from '@webb-tools/bridges';
import { DeployerConfig, BridgeInput, GovernorConfig } from '@webb-tools/interfaces';
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';

export async function run() {

  const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
  const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
  const providerKovan = new ethers.providers.JsonRpcProvider(`https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
  const walletKovan = new ethers.Wallet(process.env.PRIVATE_KEY!, providerKovan);
  const providerRopsten = new ethers.providers.JsonRpcProvider(`https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
  const walletRopsten = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRopsten);
  const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
  const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);
  const providerOptimism = new ethers.providers.JsonRpcProvider('https://kovan.optimism.io');
  const walletOptimism = new ethers.Wallet(process.env.PRIVATE_KEY!, providerOptimism);
  const providerArbitrum = new ethers.providers.JsonRpcProvider('https://rinkeby.arbitrum.io/rpc');
  const walletArbitrum = new ethers.Wallet(process.env.PRIVATE_KEY!, providerArbitrum);

  const bridgeInput: BridgeInput = {
    anchorInputs: {
      asset: {
        3: ['0x0000000000000000000000000000000000000000'],
        4: ['0x0000000000000000000000000000000000000000'],
        5: ['0x0000000000000000000000000000000000000000'],
        42: ['0x0000000000000000000000000000000000000000'],
        69: ['0x0000000000000000000000000000000000000000'],
        421611: ['0x0000000000000000000000000000000000000000'],
      },
      anchorSizes: ['100000000'],
    },
    chainIDs: [3, 4, 5, 42, 69, 421611],
  };

  //Record<number, ethers.Signer>;
  const deployers: DeployerConfig = {
    3: walletRopsten,
    4: walletRinkeby,
    5: walletGoerli,
    42: walletKovan,
    69: walletOptimism,
    421611: walletArbitrum,
  };

  const governorsConfig: GovernorConfig = {
    3: walletRopsten,
    4: walletRinkeby,
    5: walletGoerli,
    42: walletKovan,
    69: walletOptimism,
    421611: walletArbitrum,
  }

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/poseidon_anchor_2.wasm'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/witness_calculator.js'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey')
  );

  const bridge = await SignatureBridge.deployFixedDepositBridge(bridgeInput, deployers, governorsConfig, zkComponents);

  // print out all the info for the addresses to run 
  const bridgeConfig = await bridge.exportConfig();

  bridgeConfig.anchors.forEach((anchor) => {
    anchor.signer.getChainId().then((res) => {
      console.log(`Anchor ${anchor.contract.address} for chain ${res}`);
    })
  })

  bridgeConfig.bridgeSides.forEach((side) => {
    side.admin.getChainId().then((res) => {
      console.log(`BridgeSide ${side.contract.address} for chain ${res}`);
    })
  })

  bridgeConfig.webbTokenAddresses.forEach((address, chainId) => {
    console.log(`webbToken entry: ${address} for chain ${chainId}`);
  })
}

run();

