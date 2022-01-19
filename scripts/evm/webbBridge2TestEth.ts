require('dotenv').config();
import { ethers } from 'ethers';
import { Bridge, BridgeInput, DeployerConfig } from '@webb-tools/bridges';

export async function run() {

  const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
  const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
  const providerKovan = new ethers.providers.JsonRpcProvider(`https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
  const walletKovan = new ethers.Wallet(process.env.PRIVATE_KEY!, providerKovan);
  const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
  const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);

  const bridgeInput: BridgeInput = {
    anchorInputs: {
      asset: {
        4: ['0x65fd9f7e75Abaa40fD349948e52291Bb0108eE0B'],
        5: ['0x72277b0eae5c965f735cde6c54d6d7ab177186e6'],
      },
      anchorSizes: ['100000000000000000'],
    },
    chainIDs: [4, 5],
  };

  //Record<number, ethers.Signer>;
  const deployers: DeployerConfig = {
    // 3: walletRopsten,
    4: walletRinkeby,
    5: walletGoerli,
  };

  const bridge = await Bridge.deployFixedDepositBridge(bridgeInput, deployers);

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

