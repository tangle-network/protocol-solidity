require('dotenv').config();
const path = require('path');
import { ethers } from 'ethers';
import { Anchor } from '@webb-tools/anchors';
import { fetchComponentsFromFilePaths, toFixedHex } from '@webb-tools/utils';
import { viewRootAcrossBridge } from '../viewActions/viewRootAcrossBridge';


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

async function run() { 
  let zkComponents6 = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey')
  );
  // const goerliBridgeSide = await BridgeSide.connect('0x6464BCd6eD9E73B4858bcD519DC89f257B23b8B6', walletGoerli);
  const ropstenAnchor = await Anchor.connect('0x97747a4De7302Ff7Ee3334e33138879469BFEcf8', zkComponents6, walletRopsten);
  await ropstenAnchor.update(11795573);
  const rinkebyAnchor = await Anchor.connect('0x09B722aA809A076027FA51902e431a8C03e3f8dF', zkComponents6, walletRinkeby);

  viewRootAcrossBridge(ropstenAnchor, rinkebyAnchor);

  // await goerliBridgeSide.setAnchorHandler(goerliHandler);
  // await goerliBridgeSide.voteProposal(rinkebyAnchor, goerliAnchor);
  // await goerliBridgeSide.executeProposal(rinkebyAnchor, goerliAnchor);
}

run();
