require('dotenv').config();
import { ethers } from 'ethers';
import { Bridge, BridgeInput, DeployerConfig } from '../../packages/fixed-bridge';

export async function run() {

  const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
  const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
  const providerHarmonyTestnet0 = new ethers.providers.JsonRpcProvider(`https://api.s0.b.hmny.io`);
  const walletHarmonyTestnet0 = new ethers.Wallet(process.env.PRIVATE_KEY!, providerHarmonyTestnet0);

  const bridgeInput: BridgeInput = {
    anchorInputs: {
      asset: {
        4: ['0x7Cec2Bf7D9c4C3C96Da8a0BfeBAB1E84b8212394'],
        1666700000: ['0x9d609F54536Cef34f5F612BD976ca632F1fa208E'],
      },
      anchorSizes: ['100000000000000000'],
    },
    chainIDs: [4, 1666700000],
  };

  //Record<number, ethers.Signer>;
  const deployers: DeployerConfig = {
    // 3: walletRopsten,
    4: walletRinkeby,
    1666700000: walletHarmonyTestnet0,
  };

  const bridge = await Bridge.deployBridge(bridgeInput, deployers);

  // print out all the info for the addresses to run 
  const bridgeConfig = await bridge.exportConfig();

  for (const anchor of bridgeConfig.anchors.values()) {
    const chainId = await anchor.signer.getChainId();
    console.log(`Anchor ${anchor.contract.address} for chain ${chainId}`);
  };

  for (const bridgeSide of bridgeConfig.bridgeSides.values()) {
    const chainId = await bridgeSide.admin.getChainId();
    console.log(`BridgeSide ${bridgeSide.contract.address} for chain ${chainId}`);
  }

  for (const webbToken of bridgeConfig.webbTokenAddresses.entries()) {
    console.log(`webbToken entry: ${webbToken[0]} + ${webbToken[1]}`);
  }
}

run();

