require('dotenv').config();
import { ethers } from 'ethers';
import Bridge, { BridgeInput, DeployerConfig } from '../../lib/darkwebb/Bridge';

export async function run() {

  const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
  const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
  const providerHarmony0 = new ethers.providers.JsonRpcProvider(`https://api.s0.b.hmny.io`);
  const walletHarmony0 = new ethers.Wallet(process.env.PRIVATE_KEY!, providerHarmony0);
  const providerHarmony1 = new ethers.providers.JsonRpcProvider(`https://api.s1.b.hmny.io`);
  const walletHarmony1 = new ethers.Wallet(process.env.PRIVATE_KEY!, providerHarmony1);
  const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
  const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);

  const bridgeInput: BridgeInput = {
    anchorInputs: [
      {
        asset: '0x6cF293c958014d4Cc71abF59839a73203F966A80',
        anchorSizes: ['100000'],
      },
      {
        asset: '0x77D14E1A56159E47595E6fC5B66C07e9BCb2AD83',
        anchorSizes: ['100000'],
      },
      {
        asset: '0x71146bacc36692f8bCd5dFFE9b65Ef52c3b59CD8',
        anchorSizes: ['100000'],
      },
      {
        asset: '0xE76487e634b6437dbb6246b2b842D40EdDBAdaAa',
        anchorSizes: ['100000'],
      },
    ],
    chainIDs: [4, 5, 1666700000, 1666700001],
  };

  //Record<number, ethers.Signer>;
  const deployers: DeployerConfig = {
    4: walletRinkeby,
    5: walletGoerli,
    1666700000: walletHarmony0,
    1666700001: walletHarmony1,
  };

  const bridge = await Bridge.deployBridge(bridgeInput, deployers);

  // print out all the info for the addresses to run 
  // const bridgeConfig = await bridge.exportConfig();

  // for (const anchor of bridgeConfig.anchors.values()) {
  //   const chainId = await anchor.signer.getChainId();
  //   console.log(`Anchor ${anchor.contract.address} for chain ${chainId}`);
  // };

  // for (const bridgeSide of bridgeConfig.bridgeSides.values()) {
  //   const chainId = await bridgeSide.admin.getChainId();
  //   console.log(`BridgeSide ${bridgeSide.contract.address} for chain ${chainId}`);
  // }

  // for (const webbToken of bridgeConfig.webbTokenAddresses.entries()) {
  //   console.log(`webbToken entry: ${webbToken[0]} + ${webbToken[1]}`);
  // }
}

run();