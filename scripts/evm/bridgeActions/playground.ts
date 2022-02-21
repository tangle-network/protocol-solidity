require('dotenv').config();
const path = require('path');
import { ethers } from 'ethers';
import { Anchor } from '@webb-tools/anchors';
import { fetchComponentsFromFilePaths, toFixedHex } from '@webb-tools/utils';
import { SignatureBridgeSide } from '@webb-tools/bridges';
import { changeGovernor } from './changeGovernor';

const providerRopsten = new ethers.providers.JsonRpcProvider(`https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletRopsten = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRopsten);
const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);
const providerPolygon = new ethers.providers.JsonRpcProvider(`https://rpc-mumbai.maticvigil.com/`);
const walletPolygon = new ethers.Wallet(process.env.PRIVATE_KEY!, providerPolygon);
const providerOptimism = new ethers.providers.JsonRpcProvider('https://kovan.optimism.io');
const walletOptimism = new ethers.Wallet(process.env.PRIVATE_KEY!, providerOptimism);
const providerArbitrum = new ethers.providers.JsonRpcProvider('https://rinkeby.arbitrum.io/rpc');
const walletArbitrum = new ethers.Wallet(process.env.PRIVATE_KEY!, providerArbitrum);

const nepocheRelayer = "0x48D41E139D3133F1879Ce5080b9C2CB4878332c2";

async function run() { 
  let zkComponents6 = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey')
  );

  const rinkebyBridgeSide = await SignatureBridgeSide.connect("0x5178bfc08793d1200b3cd9f3715fa543cd1049e3", walletRinkeby, walletRinkeby)
  const ropstenBridgeSide = await SignatureBridgeSide.connect("0x40cd42f6bdb1dd65ee161ff66de4cb46ff8145c2", walletRopsten, walletRopsten)
  const goerliBridgeSide = await SignatureBridgeSide.connect("0x2aab82c6abfb764b34f14904fa4c3f40b4771fe2", walletGoerli, walletGoerli)
  const polygonBridgeSide = await SignatureBridgeSide.connect("0x7ddb3730bee148c989802e9ad6c3dc0e8ff27b77", walletPolygon, walletPolygon)
  const optimismBridgeSide = await SignatureBridgeSide.connect("0x9ada618efd944fe63d651717353432a419738ac8", walletOptimism, walletOptimism)
  const arbitrumBridgeSide = await SignatureBridgeSide.connect("0x4446bccbde6d906e0cd65a55eb13913018ab1f58", walletArbitrum, walletArbitrum)

  const bridgeSides: { side: SignatureBridgeSide, gasLimit: string, wallet: ethers.Wallet }[] = [
    { side: rinkebyBridgeSide, gasLimit: '0x5B8D80', wallet: walletRinkeby },
    { side: ropstenBridgeSide, gasLimit: '0x5B8D80', wallet: walletRopsten },
    { side: goerliBridgeSide, gasLimit: '0x5B8D80', wallet: walletGoerli },
    { side: polygonBridgeSide, gasLimit: '0x5B8D80', wallet: walletPolygon },
    { side: optimismBridgeSide, gasLimit: '0x5B8D80', wallet: walletOptimism },
    { side: arbitrumBridgeSide, gasLimit: '0x99999999', wallet: walletArbitrum },
  ];

  Promise.all(bridgeSides.map((entry) => {
      changeGovernor(entry.side.contract.address, nepocheRelayer, entry.wallet, { gasLimit: entry.gasLimit } )
  }));
}

run();
