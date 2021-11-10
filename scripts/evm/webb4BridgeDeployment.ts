require('dotenv').config();
import { ethers } from 'ethers';
import Bridge, { BridgeInput, DeployerConfig } from '../../lib/bridge/Bridge';

export async function run() {

  const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
  const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
  const providerRopsten = new ethers.providers.JsonRpcProvider(`https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
  const walletRopsten = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRopsten);
  const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
  const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);
  const providerArbitrum = new ethers.providers.JsonRpcProvider('https://rinkeby.arbitrum.io/rpc');
  const walletArbitrum = new ethers.Wallet(process.env.PRIVATE_KEY!, providerArbitrum);

  const bridgeInput: BridgeInput = {
    anchorInputs: {
      asset: {
        3: ['0x0000000000000000000000000000000000000000'],
        4: ['0x0000000000000000000000000000000000000000'],
        5: ['0x0000000000000000000000000000000000000000'],
        421611: ['0x0000000000000000000000000000000000000000'],
      },
      anchorSizes: ['10000000000000000'],
    },
    chainIDs: [3, 4, 5, 421611],
  };

  const deployers: DeployerConfig = {
    3: walletRopsten,
    4: walletRinkeby,
    5: walletGoerli,
    421611: walletArbitrum,
  };

  const bridge = await Bridge.deployBridge(bridgeInput, deployers);
}

run();